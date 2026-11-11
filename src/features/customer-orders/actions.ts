"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { flushPushOutboxQuietly } from "@/features/notifications/dispatch";
import { storefrontProductSchema, type StorefrontProduct } from "@/features/storefront/schemas";
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
    const addressIssue = parsed.error.issues.some((issue) => issue.path[0] === "addressId");
    return { ok: false, error: addressIssue ? "address_required" : "generic" };
  }
  const supabase = await getSupabaseServerClient();
  // The database checks the address is the shopper's own, has a pin, and is inside the
  // dukan's delivery radius.
  const { data, error } = await supabase.rpc("place_customer_order", {
    p_shop_id: parsed.data.shopId,
    p_items: parsed.data.items.map((item) => ({ inventory_id: item.inventoryId, qty: item.qty })),
    p_address_id: parsed.data.addressId,
    p_note: parsed.data.note || undefined,
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

const reorderSchema = z.array(storefrontProductSchema.extend({ qty: z.number().int().min(1) }));
export type ReorderLine = StorefrontProduct & { qty: number };

/** What can be ordered again from a past order, at today's prices, for the cart. */
export async function getReorderLines(orderId: string): Promise<OrderResult<ReorderLine[]>> {
  const id = z.uuid().safeParse(orderId);
  if (!id.success) return { ok: false, error: "generic" };
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("reorder_customer_order", { p_order_id: id.data });
  if (error) return { ok: false, error: orderErrorKey(error.message) };
  const lines = reorderSchema.safeParse(data);
  return lines.success ? { ok: true, data: lines.data } : { ok: false, error: "generic" };
}

const rateSchema = z.object({
  orderId: z.uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

/** Stars (and a few words) for the dukan after a delivered order. */
export async function rateOrder(
  orderId: string,
  rating: number,
  comment?: string,
): Promise<OrderResult<{ rating: number }>> {
  const parsed = rateSchema.safeParse({ orderId, rating, comment });
  if (!parsed.success) return { ok: false, error: "invalid_rating" };
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("rate_customer_order", {
    p_order_id: parsed.data.orderId,
    p_rating: parsed.data.rating,
    p_comment: parsed.data.comment || undefined,
  });
  if (error) return { ok: false, error: orderErrorKey(error.message) };
  refresh();
  return { ok: true, data: { rating: parsed.data.rating } };
}
