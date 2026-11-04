"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Admin changes. The RPCs check for an admin and write the audit log; these map errors. */

export type AdminError = "generic" | "not_allowed" | "reason_required" | "invalid";
export type AdminResult = { ok: true } | { ok: false; error: AdminError };

function errorKey(message: string | undefined): AdminError {
  if (message === "not_allowed" || message === "not_authorized") return "not_allowed";
  if (message === "reason_required") return "reason_required";
  if (message === "invalid_status" || message === "invalid_input") return "invalid";
  return "generic";
}

const id = z.uuid();
const reason = z.string().trim().max(300);

async function run(fn: string, args: Record<string, unknown>): Promise<AdminResult> {
  await requireRole("admin", "/admin");
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc(fn as "admin_set_flag", args as never);
  if (error) return { ok: false, error: errorKey(error.message) };
  refresh();
  return { ok: true };
}

export type Target = "shop" | "org";

/** Approve a dukan or distributor that is waiting, or reject it with a reason. */
export async function decide(
  target: Target,
  targetId: string,
  approve: boolean,
  why = "",
): Promise<AdminResult> {
  const parsedId = id.safeParse(targetId);
  const parsedReason = reason.safeParse(why);
  if (!parsedId.success || !parsedReason.success) return { ok: false, error: "invalid" };
  if (!approve && parsedReason.data.length < 3) return { ok: false, error: "reason_required" };
  if (target === "shop") {
    return approve
      ? run("approve_shop", { p_shop_id: parsedId.data })
      : run("reject_shop", { p_shop_id: parsedId.data, p_reason: parsedReason.data });
  }
  return approve
    ? run("approve_organization", { p_org_id: parsedId.data })
    : run("reject_organization", { p_org_id: parsedId.data, p_reason: parsedReason.data });
}

/** Pause an approved dukan or distributor (with a reason), or start a paused one again. */
export async function setActive(
  target: Target,
  targetId: string,
  active: boolean,
  why = "",
): Promise<AdminResult> {
  const parsedId = id.safeParse(targetId);
  const parsedReason = reason.safeParse(why);
  if (!parsedId.success || !parsedReason.success) return { ok: false, error: "invalid" };
  const status = active ? "approved" : "suspended";
  return target === "shop"
    ? run("admin_set_shop_status", {
        p_shop_id: parsedId.data,
        p_status: status,
        p_reason: parsedReason.data || null,
      })
    : run("admin_set_org_status", {
        p_org_id: parsedId.data,
        p_status: status,
        p_reason: parsedReason.data || null,
      });
}

export async function setFlag(key: string, enabled: boolean): Promise<AdminResult> {
  const parsed = z.object({ key: z.string().regex(/^[a-z][a-z0-9_]*$/), enabled: z.boolean() });
  const input = parsed.safeParse({ key, enabled });
  if (!input.success) return { ok: false, error: "invalid" };
  return run("admin_set_flag", { p_key: input.data.key, p_enabled: input.data.enabled });
}
