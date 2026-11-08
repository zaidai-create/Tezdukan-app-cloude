import "server-only";
import { getOpenAI, DEFAULT_MODEL } from "./client";
import { AssistantReply, type AssistantReplyT } from "@/lib/schemas";
import type { ChatRole, ProjectStatus } from "@/lib/supabase/types";

export type AgentContext = {
  status: ProjectStatus;
  pdfs: { filename: string; page_count: number | null; text_sample?: string }[];
  images: { index: number; filename: string; text_sample?: string }[];
  invoices: { label: string; invoice_number?: string | null; source_page?: number | null; data?: unknown }[];
  conversation: { role: ChatRole; content: string }[];
  user_message: string;
};

const SYSTEM_PROMPT = `You are InvoicePilot AI, a conversational agent that helps users prepare revised copies of invoice documents through a strict step-by-step workflow.

You do NOT edit documents yourself — you plan changes. A separate deterministic processing engine applies the approved plan.

Workflow states and what you must do in each:
- WAITING_FOR_PDF: Ask the user to upload the original PDF first. Do not request changes yet.
- PDF_RECEIVED: Confirm the PDF was received; ask for the invoice images next.
- WAITING_FOR_IMAGES: Accept image uploads and confirm as they arrive. Ask the user to tell you when they have uploaded ALL images.
- IMAGES_RECEIVED: Ask what changes the user wants.
- COLLECTING_CHANGES: Capture changes. If information is missing, ask ONE clear question at a time via "ask". Never invent values. Never silently overwrite conflicting information.
- CHANGE_SUMMARY: Produce a structured plan in "plan" and ask the user to approve, modify, or cancel. Set next_status to CHANGE_SUMMARY.
- APPROVED: After explicit user approval, set next_status to APPROVED.
- PROCESSING / QUALITY_CHECK / COMPLETED: Owned by the server; do not transition into these from your reply.

Rules:
- Return ONLY a JSON object matching the schema. No prose outside JSON.
- Supported change categories: company name, company address, NTN and registration details, customer reference, supply serial numbers, internal adjustment dates, invoice annotations, other corrections. Keep invoice numbers unchanged unless the user explicitly asks otherwise.
- NEVER fabricate supplier-issued facts (dates, tax details, signatures, stamps, registrations). Flag requests that could misrepresent an official record and ask for clarification instead.
- Advance next_status only when the current state's entry conditions are met (e.g. move to COLLECTING_CHANGES only after the user confirms all images are uploaded).
- Each invoice in the plan carries a stable "label" like "Invoice 1" so the user can identify it.
`;

export async function runAgent(ctx: AgentContext): Promise<AssistantReplyT> {
  const openai = getOpenAI();

  const systemSummary = [
    `Current workflow state: ${ctx.status}.`,
    `Uploaded PDFs (${ctx.pdfs.length}): ${ctx.pdfs.map((p) => `${p.filename} (${p.page_count ?? "?"} pages)`).join(", ") || "none"}.`,
    `Uploaded images (${ctx.images.length}): ${ctx.images.map((i) => i.filename).join(", ") || "none"}.`,
    ctx.invoices.length
      ? `Detected invoices: ${ctx.invoices.map((inv) => `${inv.label}${inv.invoice_number ? ` [#${inv.invoice_number}]` : ""}`).join(", ")}.`
      : "",
  ].filter(Boolean).join("\n");

  const messages: OpenAIMsg[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: systemSummary },
    ...ctx.conversation.map((m) => ({ role: toOpenAIRole(m.role), content: m.content })),
    { role: "user", content: ctx.user_message },
  ];

  const rsp = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages,
  });

  const raw = rsp.choices[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { parsed = { message: raw }; }

  const safe = AssistantReply.safeParse(parsed);
  if (safe.success) return safe.data;
  return {
    message: typeof (parsed as Record<string, unknown>).message === "string"
      ? String((parsed as Record<string, unknown>).message)
      : "Sorry, I couldn't understand that. Could you rephrase?",
  };
}

type OpenAIMsg = { role: "system" | "user" | "assistant"; content: string };
function toOpenAIRole(r: ChatRole): OpenAIMsg["role"] {
  return r === "assistant" ? "assistant" : r === "system" ? "system" : "user";
}

// Vision analysis of a single invoice image. Returns extracted fields and raw
// text. If OCR / vision fails, we return minimal data rather than crash the
// upload flow.
export async function analyzeInvoiceImage(dataUrl: string): Promise<{
  invoice_number?: string;
  customer?: string;
  supplier?: string;
  date?: string;
  total?: string;
  raw_text?: string;
  confidence: number;
}> {
  const openai = getOpenAI();
  const rsp = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Extract structured fields from an invoice image. Respond ONLY with JSON: {invoice_number, customer, supplier, date, total, raw_text, confidence (0..1)}. Use empty string if unknown. Do not invent values.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract invoice fields from this image." },
          { type: "image_url", image_url: { url: dataUrl } },
        ] as unknown as string,
      },
    ],
  });

  try {
    const raw = rsp.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      invoice_number: str(parsed.invoice_number),
      customer: str(parsed.customer),
      supplier: str(parsed.supplier),
      date: str(parsed.date),
      total: str(parsed.total),
      raw_text: str(parsed.raw_text),
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    };
  } catch {
    return { confidence: 0 };
  }
}

function str(v: unknown) {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
