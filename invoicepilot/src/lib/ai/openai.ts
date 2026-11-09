import "server-only";
import OpenAI from "openai";
import { AssistantReply, type AssistantReplyT } from "@/lib/schemas";
import {
  SYSTEM_PROMPT,
  buildContextSummary,
  VISION_PROMPT,
  str,
  type AgentContext,
  type VisionResult,
} from "./shared";

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

let cached: OpenAI | null = null;
function client() {
  if (cached) return cached;
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  cached = new OpenAI({ apiKey: key });
  return cached;
}

export async function runAgent(ctx: AgentContext): Promise<AssistantReplyT> {
  const openai = client();
  const rsp = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: buildContextSummary(ctx) },
      ...ctx.conversation.map((m) => ({
        role: (m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user") as
          | "assistant" | "system" | "user",
        content: m.content,
      })),
      { role: "user", content: ctx.user_message },
    ],
  });

  const raw = rsp.choices[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { parsed = { message: raw }; }
  const safe = AssistantReply.safeParse(parsed);
  if (safe.success) return safe.data;
  return {
    message:
      typeof (parsed as Record<string, unknown>).message === "string"
        ? String((parsed as Record<string, unknown>).message)
        : "Sorry, I couldn't understand that. Could you rephrase?",
  };
}

export async function analyzeInvoiceImage(dataUrl: string): Promise<VisionResult> {
  const openai = client();
  const rsp = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: VISION_PROMPT },
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
