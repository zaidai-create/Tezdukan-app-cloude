import "server-only";
import type { ChatRole, ProjectStatus } from "@/lib/supabase/types";

export type AgentContext = {
  status: ProjectStatus;
  pdfs: { filename: string; page_count: number | null; text_sample?: string }[];
  images: { index: number; filename: string; text_sample?: string }[];
  invoices: { label: string; invoice_number?: string | null; source_page?: number | null; data?: unknown }[];
  conversation: { role: ChatRole; content: string }[];
  user_message: string;
};

export const SYSTEM_PROMPT = `You are InvoicePilot AI, a conversational agent that helps users prepare revised copies of invoice documents through a strict step-by-step workflow.

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
- Return ONLY a JSON object matching this shape: {"message": string, "next_status"?: string, "ask"?: string, "plan"?: {"summary": string, "invoices": [{"label": string, "changes": {"target": {"invoice_number"?: string, "source_page"?: number, "image_index"?: number}, "keep_invoice_number": boolean, "customer_reference"?: string, "internal_supply_serial"?: string, "internal_adjustment_date"?: string, "company_name"?: string, "company_address"?: string, "ntn"?: string, "registration_details"?: string, "annotations"?: string[], "notes"?: string}}], "needs_more_info": boolean, "questions": string[]}}. No prose outside JSON.
- Supported change categories: company name, company address, NTN and registration details, customer reference, supply serial numbers, internal adjustment dates, invoice annotations, other corrections. Keep invoice numbers unchanged unless the user explicitly asks otherwise.
- NEVER fabricate supplier-issued facts (dates, tax details, signatures, stamps, registrations). Flag requests that could misrepresent an official record and ask for clarification instead.
- Advance next_status only when the current state's entry conditions are met (e.g. move to COLLECTING_CHANGES only after the user confirms all images are uploaded).
- Each invoice in the plan carries a stable "label" like "Invoice 1" so the user can identify it.
`;

export function buildContextSummary(ctx: AgentContext): string {
  return [
    `Current workflow state: ${ctx.status}.`,
    `Uploaded PDFs (${ctx.pdfs.length}): ${ctx.pdfs.map((p) => `${p.filename} (${p.page_count ?? "?"} pages)`).join(", ") || "none"}.`,
    `Uploaded images (${ctx.images.length}): ${ctx.images.map((i) => i.filename).join(", ") || "none"}.`,
    ctx.invoices.length
      ? `Detected invoices: ${ctx.invoices.map((inv) => `${inv.label}${inv.invoice_number ? ` [#${inv.invoice_number}]` : ""}`).join(", ")}.`
      : "",
  ].filter(Boolean).join("\n");
}

export const VISION_PROMPT =
  "Extract structured fields from an invoice image. Respond ONLY with JSON: {\"invoice_number\": string, \"customer\": string, \"supplier\": string, \"date\": string, \"total\": string, \"raw_text\": string, \"confidence\": number between 0 and 1}. Use an empty string if a field is unknown. Do not invent values.";

export type VisionResult = {
  invoice_number?: string;
  customer?: string;
  supplier?: string;
  date?: string;
  total?: string;
  raw_text?: string;
  confidence: number;
};

export function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
