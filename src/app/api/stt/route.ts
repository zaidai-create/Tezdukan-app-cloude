import { NextResponse } from "next/server";
import { locales } from "@/i18n/locales";
import { sttProvider, transcribe } from "@/lib/integrations/stt";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MAX_BYTES = 4_000_000;
const noStore = { "Cache-Control": "no-store" };

/** Whether server speech-to-text is on; when it is off the app uses the phone's own. */
export function GET() {
  return NextResponse.json({ available: sttProvider() !== "browser" }, { headers: noStore });
}

/** A short voice clip (multipart: audio, locale) in, its text out. Signed-in people only. */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (sttProvider() === "browser") {
    return NextResponse.json({ error: "stt_not_configured" }, { status: 503, headers: noStore });
  }

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  const locale = String(form?.get("locale") ?? "en");
  if (!(audio instanceof Blob) || audio.size === 0 || audio.size > MAX_BYTES) {
    return NextResponse.json({ error: "invalid_audio" }, { status: 400 });
  }
  if (!(locales as readonly string[]).includes(locale)) {
    return NextResponse.json({ error: "invalid_locale" }, { status: 400 });
  }

  try {
    const text = await transcribe(audio, locale);
    return NextResponse.json({ text }, { headers: noStore });
  } catch (error) {
    console.error("[stt]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "stt_failed" }, { status: 502, headers: noStore });
  }
}
