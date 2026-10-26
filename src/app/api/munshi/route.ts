import { NextResponse } from "next/server";
import { z } from "zod";
import { locales } from "@/i18n/locales";
import { getAiConfig } from "@/lib/ai/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  locale: z.enum(locales),
  screen: z.string().max(200).optional(),
});

/**
 * Munshi entry point. Validates the caller and the request; the tool-calling agent behind
 * it is built on the AI gateway in Phase 5. Without a provider key it answers with a clear
 * `ai_not_configured` status that the sheet shows as a Sandbox notice.
 */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const ai = getAiConfig();
  if (!ai.configured) {
    return NextResponse.json(
      { error: "ai_not_configured", provider: ai.AI_PROVIDER },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { error: "agent_unavailable" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
