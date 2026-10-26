import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";
import { defaultLocale, isLocale } from "@/i18n/locales";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { appRoles, roleHome, type AppRole } from "./roles";
import { isUsable, type RoleContext, type ShellSession } from "./session-types";

const profileSchema = z.object({
  id: z.uuid(),
  full_name: z.string().nullable(),
  phone: z.string().nullable(),
  avatar_path: z.string().nullable(),
  locale: z.string().nullable(),
  active_role: z.enum(appRoles),
  active_shop_id: z.uuid().nullable(),
  active_org_id: z.uuid().nullable(),
});

const contextRowSchema = z.object({
  role: z.enum(appRoles),
  context_id: z.uuid().nullable(),
  context_name: z.string().nullable(),
  member_role: z.string().nullable(),
  status: z.string().nullable(),
  image_path: z.string().nullable(),
});

/** Public URL for an object in a public bucket ("shop-media/…", "product-images/…"). */
function publicUrl(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  path: string | null,
  bucket = "shop-media",
): string | null {
  if (!path) return null;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/**
 * The signed-in person, their profile and every role context they hold. Request-scoped
 * (React cache) so layouts and pages share one lookup. Returns null when signed out.
 */
export const getShellSession = cache(async (): Promise<ShellSession | null> => {
  const supabase = await getSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return null;

  const [profileResult, contextsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, phone, avatar_path, locale, active_role, active_shop_id, active_org_id",
      )
      .eq("id", userId)
      .single(),
    supabase.rpc("my_role_contexts"),
  ]);
  if (profileResult.error || contextsResult.error) {
    throw new Error("Could not load your account. Please try again.");
  }

  const profile = profileSchema.parse(profileResult.data);
  const contexts: RoleContext[] = z
    .array(contextRowSchema)
    .parse(contextsResult.data)
    .map((row) => ({
      role: row.role,
      contextId: row.context_id,
      name: row.context_name,
      memberRole: row.member_role,
      status: row.status,
      imageUrl: publicUrl(supabase, row.image_path),
    }));

  const activeContextId =
    profile.active_role === "dukandar"
      ? profile.active_shop_id
      : ["distributor", "booker", "rider"].includes(profile.active_role)
        ? profile.active_org_id
        : null;

  return {
    userId,
    fullName: profile.full_name ?? "",
    phone: profile.phone,
    avatarUrl: publicUrl(supabase, profile.avatar_path, "shop-media"),
    locale: profile.locale && isLocale(profile.locale) ? profile.locale : defaultLocale,
    activeRole: profile.active_role,
    activeContextId,
    contexts,
  };
});

/** Signed-in session or a redirect to login. */
export async function requireSession(): Promise<ShellSession> {
  const session = await getShellSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Session acting as `role`. If the person holds that role but is currently acting as another,
 * hand off to the switch route (cookies can only be written there) and come back. Otherwise
 * send them to their own home.
 */
export async function requireRole(role: AppRole, returnTo: string): Promise<ShellSession> {
  const session = await requireSession();
  if (session.activeRole === role) return session;
  const candidate = session.contexts.find((c) => c.role === role && isUsable(c));
  if (candidate) {
    const params = new URLSearchParams({ role, next: returnTo });
    if (candidate.contextId) params.set("context", candidate.contextId);
    redirect(`/api/context/switch?${params}`);
  }
  redirect(roleHome[session.activeRole]);
}
