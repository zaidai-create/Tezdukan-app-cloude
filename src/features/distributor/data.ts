import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { ZodType } from "zod";
import { requireRole } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  dashboardSchema,
  inboxSchema,
  insightsSchema,
  orgOrderDetailSchema,
  type InboxTab,
} from "./schemas";

/**
 * Server-side reads for the distributor portal. Each runs as the signed-in member (the RPCs
 * check their organization permissions) and is parsed before it reaches a component.
 */

type RpcResult = { data: unknown; error: { message: string } | null };

async function parsed<T>(schema: ZodType<T>, request: PromiseLike<RpcResult>): Promise<T> {
  const { data, error } = await request;
  if (error) {
    if (error.message === "order_not_found") notFound();
    throw new Error(error.message);
  }
  return schema.parse(data);
}

/** The distributor member's session and the organization they act for. */
export const requireDistributor = cache(async (returnTo: string) => {
  const session = await requireRole("distributor", returnTo);
  const orgId = session.activeContextId;
  if (!orgId) redirect("/");
  return { session, orgId };
});

export async function getDashboard(orgId: string) {
  const supabase = await getSupabaseServerClient();
  return parsed(dashboardSchema, supabase.rpc("org_dashboard", { p_org_id: orgId }));
}

/** The 30-day view: month to date, pipeline, quiet dukans, best sellers, stock running out. */
export const getInsights = cache(async (orgId: string) => {
  const supabase = await getSupabaseServerClient();
  return parsed(insightsSchema, supabase.rpc("org_insights", { p_org_id: orgId }));
});

export async function getInbox(orgId: string, tab: InboxTab | "all", query?: string) {
  const supabase = await getSupabaseServerClient();
  return parsed(
    inboxSchema,
    supabase.rpc("org_order_inbox", {
      p_org_id: orgId,
      p_tab: tab,
      p_query: query || undefined,
      p_limit: 100,
    }),
  );
}

export async function getOrgOrder(orderId: string) {
  const supabase = await getSupabaseServerClient();
  return parsed(orgOrderDetailSchema, supabase.rpc("org_order_detail", { p_order_id: orderId }));
}
