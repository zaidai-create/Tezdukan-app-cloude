import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { historySchema, runMunshi } from "@/features/munshi/agent";
import { locales } from "@/i18n/locales";
import { getAiConfig } from "@/lib/ai/config";
import { GeminiError } from "@/lib/ai/gemini";
import { getShellSession } from "@/lib/auth/session";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  locale: z.enum(locales),
  screen: z.string().max(200).optional(),
  history: historySchema,
});

const noStore = { "Cache-Control": "no-store" };

// Screens Munshi can open, named by their navigation label.
const screenLabels = [
  "home",
  "categories",
  "nearby",
  "cart",
  "orders",
  "account",
  "products",
  "wholesale",
  "ledger",
  "stockOrders",
  "chat",
  "catalog",
  "reports",
  "store",
] as const;
type ScreenLabel = (typeof screenLabels)[number];
const isScreenLabel = (value: string): value is ScreenLabel =>
  (screenLabels as readonly string[]).includes(value);

/**
 * Munshi entry point: validates the caller and the request, then lets the agent answer with
 * the person's own permissions. Without an AI key it answers `ai_not_configured`, which the
 * sheet shows as a Sandbox notice.
 */
export async function POST(request: Request) {
  const session = await getShellSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const ai = getAiConfig();
  if (!ai.configured) {
    return NextResponse.json(
      { error: "ai_not_configured", provider: ai.AI_PROVIDER },
      { status: 503, headers: noStore },
    );
  }
  if (ai.AI_PROVIDER !== "gemini") {
    return NextResponse.json({ error: "agent_unavailable" }, { status: 503, headers: noStore });
  }

  try {
    const answer = await runMunshi({
      session,
      message: parsed.data.message,
      history: parsed.data.history,
      screen: parsed.data.screen,
    });
    if (!answer.reply && !answer.link && answer.cart.length === 0) {
      return NextResponse.json({ error: "agent_unavailable" }, { status: 503, headers: noStore });
    }
    const tNav = await getTranslations({ locale: parsed.data.locale, namespace: "nav" });
    const link = answer.link
      ? {
          href: answer.link.href,
          label: isScreenLabel(answer.link.screen) ? tNav(answer.link.screen) : answer.link.screen,
        }
      : null;
    // Only a shopper has a cart; other roles never get one back.
    const cart = session.activeRole === "customer" ? answer.cart : [];
    return NextResponse.json({ reply: answer.reply, link, cart }, { headers: noStore });
  } catch (error) {
    // Google's free tier is often busy (503) or rate-limited (429): tell people to try again.
    const busy = error instanceof GeminiError && (error.status === 429 || error.status === 503);
    const status = busy ? 429 : 503;
    console.error("[munshi]", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: busy ? "busy" : "agent_unavailable" },
      { status, headers: noStore },
    );
  }
}
