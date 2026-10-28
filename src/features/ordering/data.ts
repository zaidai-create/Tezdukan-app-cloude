import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { z, type ZodType } from "zod";
import { requireRole } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  cartSummarySchema,
  catalogListSchema,
  categoryFacetSchema,
  facetsSchema,
  homeFeedSchema,
  ledgerSchema,
  orderItemRowSchema,
  orderRowSchema,
  productDetailSchema,
  shopDistributorSchema,
  statusHistoryRowSchema,
  type OrderStatus,
} from "./schemas";

/**
 * Server-side reads for dukandar ordering. Each runs as the signed-in user (RLS and the RPCs'
 * own shop checks apply) and parses the result before it reaches a component.
 */

type RpcResult = { data: unknown; error: { message: string } | null };

async function parsed<T>(schema: ZodType<T>, request: PromiseLike<RpcResult>): Promise<T> {
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  return schema.parse(data);
}

/** The dukandar's session and the shop they are ordering for. */
export const requireDukan = cache(async (returnTo: string) => {
  const session = await requireRole("dukandar", returnTo);
  const shopId = session.activeContextId;
  if (!shopId) redirect("/");
  return { session, shopId };
});

export async function getHomeFeed(shopId: string) {
  const supabase = await getSupabaseServerClient();
  return parsed(homeFeedSchema, supabase.rpc("shop_home_feed", { p_shop_id: shopId }));
}

export async function getFacets(shopId: string, categoryId?: string) {
  const supabase = await getSupabaseServerClient();
  return parsed(
    facetsSchema,
    supabase.rpc("catalog_facets", { p_shop_id: shopId, p_category_id: categoryId }),
  );
}

export type BrowseOptions = {
  categoryId?: string;
  brandId?: string;
  orgId?: string;
  sort?: "popular" | "price_asc" | "price_desc" | "margin_desc" | "newest";
  inStock?: boolean;
  hasScheme?: boolean;
  limit?: number;
};

export async function browseCatalog(shopId: string, options: BrowseOptions = {}) {
  const supabase = await getSupabaseServerClient();
  return parsed(
    catalogListSchema,
    supabase.rpc("browse_catalog", {
      p_shop_id: shopId,
      p_category_id: options.categoryId,
      p_brand_id: options.brandId,
      p_org_id: options.orgId,
      p_sort: options.sort ?? "popular",
      p_filters: {
        ...(options.inStock ? { in_stock: true } : {}),
        ...(options.hasScheme ? { has_scheme: true } : {}),
      },
      p_limit: options.limit ?? 60,
    }),
  );
}

export async function getProductDetail(shopId: string, productId: string) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("product_detail", {
    p_shop_id: shopId,
    p_distributor_product_id: productId,
  });
  if (error?.message === "product_unavailable") notFound();
  if (error) throw new Error(error.message);
  return productDetailSchema.parse(data);
}

export async function getCart(shopId: string) {
  const supabase = await getSupabaseServerClient();
  return parsed(cartSummarySchema, supabase.rpc("cart_summary", { p_shop_id: shopId }));
}

export async function getShopDistributors(shopId: string) {
  const supabase = await getSupabaseServerClient();
  return parsed(
    z.array(shopDistributorSchema),
    supabase.rpc("shop_distributors", { p_shop_id: shopId }),
  );
}

export async function getLedger(shopId: string, orgId: string) {
  const supabase = await getSupabaseServerClient();
  return parsed(ledgerSchema, supabase.rpc("shop_ledger", { p_shop_id: shopId, p_org_id: orgId }));
}

export async function getCategoryBySlug(slug: string) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name, name_ur, tint, image_path")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  return categoryFacetSchema.omit({ product_count: true }).parse(data);
}

const ORDER_COLUMNS =
  "id, order_number, org_id, status, payment_method, payment_status, total_paisa, ordered_total_paisa, subtotal_paisa, scheme_discount_paisa, delivery_fee_paisa, paid_paisa, delivery_slot_start, delivery_slot_end, created_at, delivered_at, cancel_reason, rating, notes, source, placed_by_name, needs_confirmation, shop_confirm_requested_at, shop_confirmed_at, organizations(name, logo_path, phone)";

export const openStatuses: OrderStatus[] = ["new", "confirmed", "picking", "packed", "dispatched"];

export async function listOrders(shopId: string, filter: "open" | "past" | "all" = "all") {
  const supabase = await getSupabaseServerClient();
  let query = supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter === "open") query = query.in("status", openStatuses);
  if (filter === "past") query = query.not("status", "in", `(${openStatuses.join(",")})`);
  return parsed(z.array(orderRowSchema), query);
}

export async function getOrder(shopId: string, orderId: string) {
  const supabase = await getSupabaseServerClient();
  const [order, items, history, otp] = await Promise.all([
    supabase
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("id", orderId)
      .eq("shop_id", shopId)
      .maybeSingle(),
    supabase
      .from("order_items")
      .select(
        "id, distributor_product_id, name, name_ur, image_path, pack_label, base_qty_per_unit, quantity, base_qty, unit_price_paisa, line_total_paisa, line_discount_paisa, free_base_qty, delivered_base_qty, short_base_qty",
      )
      .eq("order_id", orderId)
      .order("created_at"),
    supabase
      .from("order_status_history")
      .select("id, from_status, to_status, changed_by_name, note, created_at")
      .eq("order_id", orderId)
      .order("created_at"),
    supabase
      .from("delivery_otps")
      .select("code, verified_at")
      .eq("order_id", orderId)
      .maybeSingle(),
  ]);
  for (const result of [order, items, history, otp]) {
    if (result.error) throw new Error(result.error.message);
  }
  if (!order.data) notFound();
  return {
    order: orderRowSchema.parse(order.data),
    items: z.array(orderItemRowSchema).parse(items.data),
    history: z.array(statusHistoryRowSchema).parse(history.data),
    otp: z
      .object({ code: z.string(), verified_at: z.string().nullable() })
      .nullable()
      .parse(otp.data),
  };
}

export async function getShopAddress(shopId: string) {
  const supabase = await getSupabaseServerClient();
  return parsed(
    z.object({
      name: z.string(),
      address_line: z.string().nullable(),
      phone: z.string().nullable(),
    }),
    supabase.from("shops").select("name, address_line, phone").eq("id", shopId).single(),
  );
}
