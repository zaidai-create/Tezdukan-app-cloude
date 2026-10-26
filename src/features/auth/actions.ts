"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { isLocale } from "@/i18n/locales";
import {
  appRoles,
  CONTEXT_COOKIE,
  roleHome,
  serializeContext,
  type AppRole,
} from "@/lib/auth/roles";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isThemePreference } from "@/lib/theme/theme";

const ONE_YEAR = 60 * 60 * 24 * 365;

export type ActionResult<T = undefined> =
  ({ ok: true } & (T extends undefined ? object : { data: T })) | { ok: false; error: string };

const switchSchema = z.object({
  role: z.enum(appRoles),
  contextId: z.uuid().nullable(),
});

/**
 * Switch the active role/context. The database validates membership and approval
 * (switch_active_context raises 42501 otherwise); the session is untouched, so nobody is
 * ever signed out by switching.
 */
export async function switchContextAction(
  role: AppRole,
  contextId: string | null,
): Promise<ActionResult<{ home: string }>> {
  const parsed = switchSchema.safeParse({ role, contextId });
  if (!parsed.success) return { ok: false, error: "invalid" };

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("switch_active_context", {
    p_role: parsed.data.role,
    p_context_id: parsed.data.contextId,
  });
  if (error) return { ok: false, error: error.code === "42501" ? "not_allowed" : "failed" };

  const cookieStore = await cookies();
  cookieStore.set(CONTEXT_COOKIE, serializeContext(parsed.data), {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return { ok: true, data: { home: roleHome[parsed.data.role] } };
}

/** Remember the language on the profile so it follows the person to other devices. */
export async function saveLocaleAction(locale: string): Promise<ActionResult> {
  if (!isLocale(locale)) return { ok: false, error: "invalid" };
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { ok: true }; // Signed out: the cookie alone is enough.
  const { error } = await supabase.from("profiles").update({ locale }).eq("id", data.claims.sub);
  return error ? { ok: false, error: "failed" } : { ok: true };
}

export async function saveThemeAction(theme: string): Promise<ActionResult> {
  if (!isThemePreference(theme)) return { ok: false, error: "invalid" };
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { ok: true };
  const { error } = await supabase.from("profiles").update({ theme }).eq("id", data.claims.sub);
  return error ? { ok: false, error: "failed" } : { ok: true };
}

export async function signOutAction(): Promise<ActionResult> {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(CONTEXT_COOKIE);
  return error ? { ok: false, error: "failed" } : { ok: true };
}
