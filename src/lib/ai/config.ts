import "server-only";
import { z } from "zod";

/**
 * Which AI provider Munshi uses, from env. The gateway (Phase 5) builds on this; until a key
 * is present Munshi reports `not_configured` and the rest of the app works as normal.
 */
const aiEnvSchema = z.object({
  AI_PROVIDER: z.enum(["anthropic", "gemini"]).default("anthropic"),
  AI_MODEL_AGENT: z.string().min(1).default("claude-opus-5-5"),
  AI_MODEL_FAST: z.string().min(1).default("claude-haiku-5-5"),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
});

export type AiConfig = z.infer<typeof aiEnvSchema> & { configured: boolean };

export function getAiConfig(): AiConfig {
  // The chosen provider if it has a key; otherwise whichever provider does. A Gemini key alone
  // (free from Google AI Studio) powers Munshi, the support assistant and voice.
  const chosen = process.env.AI_PROVIDER || undefined;
  const hasKey = (name: string | undefined) =>
    name === "anthropic"
      ? Boolean(process.env.ANTHROPIC_API_KEY)
      : name === "gemini"
        ? Boolean(process.env.GEMINI_API_KEY)
        : false;
  const provider = hasKey(chosen)
    ? chosen
    : process.env.GEMINI_API_KEY
      ? "gemini"
      : process.env.ANTHROPIC_API_KEY
        ? "anthropic"
        : chosen;
  const env = aiEnvSchema.parse({
    AI_PROVIDER: provider,
    AI_MODEL_AGENT: process.env.AI_MODEL_AGENT || undefined,
    AI_MODEL_FAST: process.env.AI_MODEL_FAST || undefined,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || undefined,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || undefined,
  });
  const configured =
    env.AI_PROVIDER === "anthropic" ? Boolean(env.ANTHROPIC_API_KEY) : Boolean(env.GEMINI_API_KEY);
  return { ...env, configured };
}
