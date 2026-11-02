import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { isLocale } from "@/i18n/locales";
import { LOCALE_COOKIE } from "@/i18n/routing";
import { START_DONE_COOKIE } from "@/features/onboarding/schemas";
import { CONTEXT_COOKIE, appRoles, roleHome, serializeContext } from "@/lib/auth/roles";
import { safeNextPath } from "@/lib/auth/safe-next";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const ONE_YEAR = 60 * 60 * 24 * 365;

const landingSchema = z.object({
  active_role: z.enum(appRoles),
  active_shop_id: z.uuid().nullable(),
  active_org_id: z.uuid().nullable(),
  locale: z.string().nullable(),
});

/**
 * After any successful sign-in: restore the person's last active role into the context
 * cookie and reconcile the language (a language picked on this device wins and is saved;
 * otherwise the profile's language is applied). Returns where to land.
 */
export async function completeSignIn(next?: string): Promise<string> {
  const supabase = await getSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return "/login";

  const { data } = await supabase
    .from("profiles")
    .select("active_role, active_shop_id, active_org_id, locale")
    .eq("id", userId)
    .single();
  const profile = landingSchema.safeParse(data);
  const cookieStore = await cookies();

  const role = profile.success ? profile.data.active_role : "customer";
  const contextId = profile.success
    ? role === "dukandar"
      ? profile.data.active_shop_id
      : ["distributor", "booker", "rider"].includes(role)
        ? profile.data.active_org_id
        : null
    : null;
  cookieStore.set(CONTEXT_COOKIE, serializeContext({ role, contextId }), {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  const deviceLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const profileLocale = profile.success ? profile.data.locale : null;
  if (deviceLocale && isLocale(deviceLocale)) {
    if (deviceLocale !== profileLocale) {
      await supabase.from("profiles").update({ locale: deviceLocale }).eq("id", userId);
    }
  } else if (profileLocale && isLocale(profileLocale)) {
    cookieStore.set(LOCALE_COOKIE, profileLocale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  }

  // Someone with only the customer role has just signed up (or never chose): ask how they
  // will use TezDukan instead of landing on the shopping home.
  if (role === "customer" && !next && !cookieStore.has(START_DONE_COOKIE)) {
    const { data: contexts } = await supabase.rpc("my_role_contexts");
    if (!Array.isArray(contexts) || contexts.length <= 1) return "/start";
  }

  return safeNextPath(next, roleHome[role]);
}
