import "server-only";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  type AdminOrderKind,
  type AdminRange,
  type AdminStatus,
  adminOrderSchema,
  adminOrgSchema,
  adminOverviewSchema,
  adminShopSchema,
  adminUserSchema,
  approvalsSchema,
  auditEntrySchema,
  flagSchema,
} from "./schemas";

/** Admin reads. Every RPC checks for platform staff itself; these only parse the answers. */

async function call<T>(
  fn: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T> {
  const supabase = await getSupabaseServerClient();
  // The admin RPCs are typed in database.types.ts; one helper keeps the pages short.
  const { data, error } = await supabase.rpc(fn as "admin_overview", args as never);
  if (error) throw new Error(error.message);
  return schema.parse(data);
}

export const getAdminOverview = (range: AdminRange) =>
  call("admin_overview", { p_range: range }, adminOverviewSchema);

export const getApprovals = () => call("admin_approvals", {}, approvalsSchema);

/**
 * Short-lived links to registration documents. The bucket is private; staff may read it under
 * their own session, and a link expires after 10 minutes so a copied one goes stale.
 */
export async function signKycDocuments(paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.storage.from("kyc-documents").createSignedUrls(paths, 600);
  if (error || !data) return new Map();
  return new Map(
    data.flatMap((item) =>
      item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : [],
    ),
  );
}

export const getAdminShops = (status: AdminStatus | null, query: string) =>
  call(
    "admin_shops",
    { p_status: status, p_query: query || null, p_limit: 150 },
    z.array(adminShopSchema),
  );

export const getAdminOrgs = (status: AdminStatus | null, query: string) =>
  call(
    "admin_organizations",
    { p_status: status, p_query: query || null, p_limit: 150 },
    z.array(adminOrgSchema),
  );

export const getAdminUsers = (query: string) =>
  call("admin_users", { p_query: query || null, p_limit: 150 }, z.array(adminUserSchema));

export const getAdminOrders = (kind: AdminOrderKind, query: string) =>
  call(
    "admin_orders",
    { p_kind: kind, p_query: query || null, p_limit: 100 },
    z.array(adminOrderSchema),
  );

export const getFlags = () => call("admin_flags", {}, z.array(flagSchema));

export const getAudit = () => call("admin_audit", { p_limit: 80 }, z.array(auditEntrySchema));
