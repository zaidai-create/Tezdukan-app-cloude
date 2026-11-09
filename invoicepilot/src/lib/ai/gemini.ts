import "server-only";
import { AssistantReply, type AssistantReplyT } from "@/lib/schemas";
import {
  SYSTEM_PROMPT,
  buildContextSummary,
  VISION_PROMPT,
  str,
  type AgentContext,
  type VisionResult,
} from "./shared";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

// Primary model (configurable) plus fallbacks used when a model is overloaded
// (503) or times out. Lite models are used first for reliability/latency.
function modelChain(): string[] {
  const primary = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
  const chain = [primary, "gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-flash-latest"];
  return [...new Set(chain)];
}

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  return key;
}

type Part = { text?: string; inlineData?: { mimeType: string; data: string } };
type Content = { role: "user" | "model"; parts: Part[] };

async function callGemini(opts: {
  system: string;
  contents: Content[];
  json: boolean;
  maxOutputTokens?: number;
  temperature?: number;
}): Promise<string> {
  const key = apiKey();
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: opts.contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      maxOutputTokens: opts.maxOutputTokens ?? 2048,
      responseMimeType: opts.json ? "application/json" : "text/plain",
    },
  });

  let lastErr = "";
  for (const model of modelChain()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetchWithTimeout(
          `${ENDPOINT}/${model}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-goog-api-key": key },
            body,
          },
          45_000,
        );
        if (res.status === 503 || res.status === 429) {
          lastErr = `${model}: ${res.status}`;
          await sleep(400 * (attempt + 1));
          continue;
        }
        if (!res.ok) {
          lastErr = `${model}: ${res.status} ${await res.text().catch(() => "")}`.slice(0, 300);
          break; // non-retryable for this model, try next model
        }
        const data = (await res.json()) as GeminiResponse;
        const text = extractText(data);
        if (text) return text;
        lastErr = `${model}: empty response`;
      } catch (err) {
        lastErr = `${model}: ${(err as Error).message}`;
        await sleep(400 * (attempt + 1));
      }
    }
  }
  throw new Error(`Gemini request failed (${lastErr})`);
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};

function extractText(data: GeminiResponse): string {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("").trim();
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runAgent(ctx: AgentContext): Promise<AssistantReplyT> {
  const contents: Content[] = [
    { role: "user", parts: [{ text: `Context:\n${buildContextSummary(ctx)}` }] },
    { role: "model", parts: [{ text: "Understood. I will follow the workflow and reply only with JSON." }] },
    ...ctx.conversation.map<Content>((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: [{ text: ctx.user_message }] },
  ];

  const raw = await callGemini({ system: SYSTEM_PROMPT, contents, json: true });
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
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return { confidence: 0 };
  const [, mimeType, data] = match;

  try {
    const raw = await callGemini({
      system: VISION_PROMPT,
      contents: [
        {
          role: "user",
          parts: [
            { text: "Extract invoice fields from this image." },
            { inlineData: { mimeType, data } },
          ],
        },
      ],
      json: true,
      temperature: 0,
    });
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
