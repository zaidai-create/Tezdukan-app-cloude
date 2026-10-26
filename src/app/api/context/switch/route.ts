import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { appRoles, CONTEXT_COOKIE, roleHome, serializeContext } from "@/lib/auth/roles";
import { safeNextPath } from "@/lib/auth/safe-next";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const querySchema = z.object({
  role: z.enum(appRoles),
  context: z.uuid().nullable(),
  next: z.string().nullable(),
});

/**
 * Used when someone opens a page for a role they hold but are not currently acting as (for
 * example a distributor link while in dukandar mode). Switches context in the database,
 * stores the cookie, and continues to the page. Never signs anyone out.
 */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    role: request.nextUrl.searchParams.get("role"),
    context: request.nextUrl.searchParams.get("context"),
    next: request.nextUrl.searchParams.get("next"),
  });
  const origin = request.nextUrl.origin;
  if (!parsed.success) return NextResponse.redirect(new URL("/", origin));

  const { role, context } = parsed.data;
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("switch_active_context", {
    p_role: role,
    // The parameter defaults to null in SQL; the generated type spells that as optional.
    p_context_id: context ?? undefined,
  });
  if (error) return NextResponse.redirect(new URL("/", origin));

  const destination = safeNextPath(parsed.data.next, roleHome[role]);
  const response = NextResponse.redirect(new URL(destination, origin));
  response.cookies.set(CONTEXT_COOKIE, serializeContext({ role, contextId: context }), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
