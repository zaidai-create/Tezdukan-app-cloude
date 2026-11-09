import "server-only";
import type { AssistantReplyT } from "@/lib/schemas";
import type { AgentContext, VisionResult } from "./shared";
import * as gemini from "./gemini";
import * as openai from "./openai";

export type { AgentContext } from "./shared";

// Provider is chosen server-side via AI_PROVIDER (default: gemini). This keeps
// the model/provider out of client code and lets us swap without touching the
// API routes.
function provider() {
  return (process.env.AI_PROVIDER ?? "gemini").toLowerCase();
}

export async function runAgent(ctx: AgentContext): Promise<AssistantReplyT> {
  return provider() === "openai" ? openai.runAgent(ctx) : gemini.runAgent(ctx);
}

export async function analyzeInvoiceImage(dataUrl: string): Promise<VisionResult> {
  return provider() === "openai" ? openai.analyzeInvoiceImage(dataUrl) : gemini.analyzeInvoiceImage(dataUrl);
}
