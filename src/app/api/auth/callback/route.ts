import { NextResponse, type NextRequest } from "next/server";
import { completeSignIn } from "@/features/auth/complete-sign-in";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Google (OAuth) comes back here with a one-time code: exchange it for a session, restore the
 * person's last role and language, and continue to where they were going. Any failure lands
 * on the sign-in screen with a message instead of an error page.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const failed = new URL("/login?oauth=failed", origin);
  if (!code) return NextResponse.redirect(failed);

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(failed);

  const destination = await completeSignIn(searchParams.get("next") ?? undefined);
  return NextResponse.redirect(new URL(destination, origin));
}
