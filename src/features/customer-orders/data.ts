import "server-only";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  customerOrderSchema,
  ITEM_COLUMNS,
  ORDER_COLUMNS,
  type OrderChange,
  orderChangeSchema,
  tabStatuses,
  type CustomerOrder,
  type InboxTab,
} from "./schemas";

/** The shopper's own orders (RLS: customer_id = auth.uid()). */
export async function getMyCustomerOrders(userId: string): Promise<CustomerOrder[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("customer_orders")
    .select(ORDER_COLUMNS)
    .eq("customer_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return z.array(customerOrderSchema).parse(data);
}

/** Whether the customer has reported a problem on this order that is still being looked at. */
export async function hasOpenProblem(orderId: string): Promise<boolean> {
  const supabase = await getSupabaseServerClient();
  const { count } = await supabase
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .eq("customer_order_id", orderId)
    .in("status", ["open", "pending"]);
  return (count ?? 0) > 0;
}

/** Lines the dukan removed or replaced, oldest first (RLS: the customer and the dukan). */
export async function getOrderChanges(orderId: string): Promise<OrderChange[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("customer_order_changes")
    .select(
      "id, kind, item_name, item_name_ur, qty, line_total_paisa, new_name, new_name_ur, new_line_total_paisa, created_at",
    )
    .eq("customer_order_id", orderId)
    .order("created_at");
  if (error) return [];
  return z.array(orderChangeSchema).parse(data);
}

/** One order with its lines; RLS lets the customer and the dukan's order staff read it. */
export async function getCustomerOrder(id: string): Promise<CustomerOrder | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("customer_orders")
    .select(`${ORDER_COLUMNS}, ${ITEM_COLUMNS}`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? customerOrderSchema.parse(data) : null;
}

export async function getShopCustomerOrders(
  shopId: string,
  tab: InboxTab,
): Promise<CustomerOrder[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("customer_orders")
    .select(ORDER_COLUMNS)
    .eq("shop_id", shopId)
    .in("status", [...tabStatuses[tab]])
    .order("created_at", { ascending: tab !== "done" })
    .limit(100);
  if (error) throw new Error(error.message);
  return z.array(customerOrderSchema).parse(data);
}

export async function countNewShopOrders(shopId: string): Promise<number> {
  const supabase = await getSupabaseServerClient();
  const { count, error } = await supabase
    .from("customer_orders")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .eq("status", "placed");
  if (error) return 0;
  return count ?? 0;
}

/** The customer's own rating of an order, if any (RLS: reviewers see their reviews). */
/** The stars this shopper gave to lines of an order: order line id → 1 to 5. */
export async function getMyItemRatings(orderId: string): Promise<Record<string, number>> {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("product_ratings")
    .select("customer_order_item_id, rating")
    .eq("customer_order_id", orderId);
  return Object.fromEntries((data ?? []).map((row) => [row.customer_order_item_id, row.rating]));
}

export async function getMyOrderRating(
  orderId: string,
): Promise<{ rating: number; comment: string | null } | null> {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("reviews")
    .select("rating, comment")
    .eq("customer_order_id", orderId)
    .maybeSingle();
  return data ? { rating: data.rating, comment: data.comment } : null;
}
