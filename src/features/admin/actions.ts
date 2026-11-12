"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { flushPushOutboxQuietly } from "@/features/notifications/dispatch";
import { requireRole } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { KycView } from "./components/kyc-documents";
import { signKycDocuments } from "./data";
import {
  type BroadcastAudience,
  type BroadcastReach,
  broadcastReachSchema,
  type SendBroadcastInput,
  sendBroadcastSchema,
} from "./schemas";

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
  // Approvals and pauses notify the owner; send the push now rather than on the next sweep.
  after(flushPushOutboxQuietly);
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

/** How far a dukan delivers (0.5 to 15 km), or across the whole city. */
export async function setShopDelivery(
  shopId: string,
  radiusM: number,
  allCity: boolean,
): Promise<AdminResult> {
  const input = z
    .object({ id, radius: z.number().int().min(500).max(15_000), allCity: z.boolean() })
    .safeParse({ id: shopId, radius: radiusM, allCity });
  if (!input.success) return { ok: false, error: "invalid" };
  return run("admin_set_shop_delivery", {
    p_shop_id: input.data.id,
    p_radius_m: input.data.radius,
    p_all_city: input.data.allCity,
  });
}

const documentsRowSchema = z.object({
  cnic_number: z.string(),
  cnic_front_path: z.string(),
  cnic_back_path: z.string(),
  place_photo_path: z.string(),
});
const taxSchema = z.object({ ntn: z.string().nullable(), strn: z.string().nullable() });

/**
 * The CNIC and place photo a dukan or distributor registered with, for any status, with links
 * that expire in 10 minutes. `null` when it registered before documents were asked for.
 */
export async function getEntityDocuments(
  target: Target,
  targetId: string,
): Promise<{ ok: true; data: KycView | null } | { ok: false; error: AdminError }> {
  await requireRole("admin", "/admin");
  const parsedId = id.safeParse(targetId);
  if (!parsedId.success) return { ok: false, error: "invalid" };
  const supabase = await getSupabaseServerClient();
  const [documents, tax] = await Promise.all([
    supabase
      .from("registration_documents")
      .select("cnic_number, cnic_front_path, cnic_back_path, place_photo_path")
      .eq(target === "shop" ? "shop_id" : "org_id", parsedId.data)
      .maybeSingle(),
    target === "shop"
      ? supabase.from("shops").select("ntn, strn").eq("id", parsedId.data).maybeSingle()
      : supabase.from("organizations").select("ntn, strn").eq("id", parsedId.data).maybeSingle(),
  ]);
  if (documents.error) return { ok: false, error: errorKey(documents.error.message) };
  if (!documents.data) return { ok: true, data: null };
  const row = documentsRowSchema.parse(documents.data);
  const taxRow = taxSchema.safeParse(tax.data);
  const signed = await signKycDocuments([
    row.cnic_front_path,
    row.cnic_back_path,
    row.place_photo_path,
  ]);
  return {
    ok: true,
    data: {
      cnicNumber: row.cnic_number,
      ntn: taxRow.success ? taxRow.data.ntn : null,
      strn: taxRow.success ? taxRow.data.strn : null,
      front: signed.get(row.cnic_front_path) ?? null,
      back: signed.get(row.cnic_back_path) ?? null,
      place: signed.get(row.place_photo_path) ?? null,
    },
  };
}

export type BroadcastError = AdminError | "person_not_found" | "rate_limited";

/** How many people an audience reaches, and how many get phone alerts. */
export async function getBroadcastReach(
  audience: Exclude<BroadcastAudience, "one">,
): Promise<{ ok: true; data: BroadcastReach } | { ok: false; error: AdminError }> {
  await requireRole("admin", "/admin/broadcast");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_broadcast_reach", { p_audience: audience });
  if (error) return { ok: false, error: errorKey(error.message) };
  const reach = broadcastReachSchema.safeParse(data);
  return reach.success ? { ok: true, data: reach.data } : { ok: false, error: "generic" };
}

/** Sends a notification (in the app and as a phone alert) to a group or one person. */
export async function sendBroadcast(
  input: SendBroadcastInput,
): Promise<
  { ok: true; data: { sent: number; push: number } } | { ok: false; error: BroadcastError }
> {
  await requireRole("admin", "/admin/broadcast");
  const parsed = sendBroadcastSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { audience, title, body, link, phone } = parsed.data;
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_broadcast", {
    p_audience: audience,
    p_title: title,
    p_body: body,
    p_link: link === "none" ? undefined : link,
    p_phone: audience === "one" ? phone : undefined,
  });
  if (error) {
    if (error.message === "person_not_found" || error.message === "rate_limited") {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: errorKey(error.message) };
  }
  const result = z.object({ sent: z.number().int(), push: z.number().int() }).safeParse(data);
  after(flushPushOutboxQuietly);
  refresh();
  return result.success ? { ok: true, data: result.data } : { ok: false, error: "generic" };
}
