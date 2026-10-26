import "server-only";
import { z } from "zod";

/**
 * Which AI provider Munshi uses, from env. The gateway (Phase 5) builds on this; until a key
 * is present Munshi reports `not_configured` and the rest of the app works as normal.
 */
const aiEnvSchema = z.object({
  AI_PROVIDER: z.enum(["anthropic", "gemini"]).default("anthropic"),
  AI_MODEL_AGENT: z.string().min(1).default("claude-sonnet-5-5"),
  AI_MODEL_FAST: z.string().min(1).default("claude-haiku-5-5"),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
});

export type AiConfig = z.infer<typeof aiEnvSchema> & { configured: boolean };

export function getAiConfig(): AiConfig {
  const env = aiEnvSchema.parse({
    AI_PROVIDER: process.env.AI_PROVIDER || undefined,
    AI_MODEL_AGENT: process.env.AI_MODEL_AGENT || undefined,
    AI_MODEL_FAST: process.env.AI_MODEL_FAST || undefined,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || undefined,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || undefined,
  });
  const configured =
    env.AI_PROVIDER === "anthropic" ? Boolean(env.ANTHROPIC_API_KEY) : Boolean(env.GEMINI_API_KEY);
  return { ...env, configured };
}
