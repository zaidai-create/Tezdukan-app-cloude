"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { flushPushOutboxQuietly } from "@/features/notifications/dispatch";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  customerOrderStatuses,
  orderErrorKey,
  placeOrderSchema,
  type CustomerOrderStatus,
  type OrderError,
  type PlaceOrderInput,
} from "./schemas";

export type OrderResult<T> = { ok: true; data: T } | { ok: false; error: OrderError };

const placedSchema = z.object({ id: z.uuid(), order_number: z.string() });

/** Places the shopper's cart at one dukan; the database prices it from the live shelf. */
export async function placeCustomerOrder(
  input: PlaceOrderInput,
): Promise<OrderResult<{ id: string; orderNumber: string }>> {
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) {
    const addressIssue = parsed.error.issues.some((issue) => issue.path[0] === "address");
    return { ok: false, error: addressIssue ? "address_required" : "generic" };
  }
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("place_customer_order", {
    p_shop_id: parsed.data.shopId,
    p_items: parsed.data.items.map((item) => ({ inventory_id: item.inventoryId, qty: item.qty })),
    p_address: parsed.data.address,
    p_request_id: parsed.data.requestId,
  });
  const placed = placedSchema.safeParse(data);
  if (error || !placed.success) return { ok: false, error: orderErrorKey(error?.message) };
  after(flushPushOutboxQuietly);
  return { ok: true, data: { id: placed.data.id, orderNumber: placed.data.order_number } };
}

const statusSchema = z.object({
  orderId: z.uuid(),
  to: z.enum(customerOrderStatuses),
  reason: z.string().trim().max(300).optional(),
});

/** Accept, reject, pack, send or deliver (dukan), or cancel while new (customer). */
export async function updateCustomerOrderStatus(
  orderId: string,
  to: CustomerOrderStatus,
  reason?: string,
): Promise<OrderResult<null>> {
  const parsed = statusSchema.safeParse({ orderId, to, reason });
  if (!parsed.success) return { ok: false, error: "generic" };
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("update_customer_order_status", {
    p_order_id: parsed.data.orderId,
    p_to: parsed.data.to,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: orderErrorKey(error.message) };
  refresh();
  after(flushPushOutboxQuietly);
  return { ok: true, data: null };
}
