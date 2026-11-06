import "server-only";
import OpenAI from "openai";

export const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

let cached: OpenAI | null = null;

export function getOpenAI() {
  if (cached) return cached;
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  cached = new OpenAI({ apiKey: key });
  return cached;
}
