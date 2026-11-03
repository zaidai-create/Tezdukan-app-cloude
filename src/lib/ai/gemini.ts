import "server-only";
import { z } from "zod";

/**
 * Minimal client for Google's official Gemini API (generativelanguage.googleapis.com), used
 * by Munshi and the support assistant. A free key from Google AI Studio is enough. Model
 * parts are passed back exactly as received, so tool calls keep any signature the model adds.
 */

export type GeminiPart = Record<string, unknown>;
export type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };
export type FunctionDeclaration = {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
};
export type FunctionCall = { id?: string; name: string; args: Record<string, unknown> };

// Comma-separated model lists, tried in order: the free tier's newest models are often busy
// (HTTP 503), so a busy, rate-limited or retired model falls through to the next one.
const geminiEnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL_AGENT: z
    .string()
    .min(1)
    .default("gemini-3.5-flash,gemini-3.5-flash-lite,gemini-flash-lite-latest,gemini-3.8-flash"),
  GEMINI_MODEL_FAST: z
    .string()
    .min(1)
    .default("gemini-3.5-flash-lite,gemini-3.5-flash,gemini-flash-lite-latest"),
});

export function modelList(value: string): string[] {
  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

const RETRYABLE = new Set([404, 429, 500, 503]);

export function geminiEnv() {
  return geminiEnvSchema.parse({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || undefined,
    GEMINI_MODEL_AGENT: process.env.GEMINI_MODEL_AGENT || undefined,
    GEMINI_MODEL_FAST: process.env.GEMINI_MODEL_FAST || undefined,
  });
}

export function hasGemini(): boolean {
  return Boolean(geminiEnv().GEMINI_API_KEY);
}

const responseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({ parts: z.array(z.record(z.string(), z.unknown())).default([]) })
          .optional(),
        finishReason: z.string().optional(),
      }),
    )
    .default([]),
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
});

const callSchema = z.object({
  functionCall: z.object({
    id: z.string().optional(),
    name: z.string(),
    args: z.record(z.string(), z.unknown()).default({}),
  }),
});

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export type GenerateResult = { parts: GeminiPart[]; text: string; calls: FunctionCall[] };

export async function geminiGenerate({
  system,
  contents,
  tools,
  jsonSchema,
  model = "agent",
  temperature = 0.3,
  attemptMs = 12_000,
  totalMs = 40_000,
}: {
  system?: string;
  contents: GeminiContent[];
  tools?: FunctionDeclaration[];
  jsonSchema?: Record<string, unknown>;
  model?: "agent" | "fast";
  temperature?: number;
  attemptMs?: number;
  totalMs?: number;
}): Promise<GenerateResult> {
  const env = geminiEnv();
  if (!env.GEMINI_API_KEY) throw new GeminiError("gemini_not_configured");
  const models = modelList(model === "agent" ? env.GEMINI_MODEL_AGENT : env.GEMINI_MODEL_FAST);

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature,
      // Shopkeepers wait on the answer: a little thinking is enough for these short tasks.
      thinkingConfig: { thinkingLevel: "low" },
      ...(jsonSchema ? { responseMimeType: "application/json", responseSchema: jsonSchema } : {}),
    },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (tools?.length) body.tools = [{ functionDeclarations: tools }];

  // The first model gets one quick second try (most 503s clear in a second), then each fallback.
  // A slow answer is treated like a busy one: the free tier sometimes queues for half a minute.
  const attempts = models.length > 0 ? [models[0] as string, ...models] : [];
  const deadline = Date.now() + totalMs;
  let response: Response | null = null;
  let timedOut = false;
  for (const [index, name] of attempts.entries()) {
    const remaining = deadline - Date.now();
    if (remaining < 1500) break;
    if (index === 1) await new Promise((resolve) => setTimeout(resolve, 700));
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(name)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(Math.min(attemptMs, remaining)),
        },
      );
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        timedOut = true;
        response = null;
        continue;
      }
      throw error;
    }
    if (response.ok || !RETRYABLE.has(response.status)) break;
  }
  if (!response && timedOut) throw new GeminiError("gemini_timeout", 503);
  if (!response) throw new GeminiError("gemini_no_model");
  if (!response.ok) throw new GeminiError(`gemini_http_${response.status}`, response.status);

  const parsed = responseSchema.safeParse(await response.json());
  if (!parsed.success) throw new GeminiError("gemini_bad_response");
  if (parsed.data.promptFeedback?.blockReason) throw new GeminiError("gemini_blocked");
  const parts = parsed.data.candidates[0]?.content?.parts ?? [];

  const calls: FunctionCall[] = [];
  let text = "";
  for (const part of parts) {
    const call = callSchema.safeParse(part);
    if (call.success) calls.push(call.data.functionCall);
    // Thought summaries are not part of the answer.
    else if (typeof part.text === "string" && part.thought !== true) text += part.text;
  }
  return { parts, text: text.trim(), calls };
}
