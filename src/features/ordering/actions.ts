"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { flushPushOutboxQuietly } from "@/features/notifications/dispatch";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { orderingErrorKey, type OrderingErrorKey } from "./errors";
import {
  paymentMethodSchema,
  placeOrderResultSchema,
  reorderResultSchema,
  type PlacedOrders,
  type ReorderResult,
} from "./schemas";

/**
 * Ordering writes that change more than the cart. Each validates its input, calls one atomic
 * RPC as the signed-in user and returns either the result or a translatable error key.
 */

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: OrderingErrorKey };

const fail = (error: unknown): { ok: false; error: OrderingErrorKey } => ({
  ok: false,
  error: orderingErrorKey(error),
});

const placeOrderInput = z.object({
  shopId: z.uuid(),
  clientRequestId: z.uuid(),
  paymentMethod: paymentMethodSchema,
  slots: z.record(z.uuid(), z.object({ start: z.string().min(10), end: z.string().min(10) })),
  notes: z.string().trim().max(1000).optional(),
  orgIds: z.array(z.uuid()).min(1).optional(),
});

export async function placeOrder(
  input: z.input<typeof placeOrderInput>,
): Promise<ActionResult<PlacedOrders>> {
  const parsed = placeOrderInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "generic" };
  const { shopId, clientRequestId, paymentMethod, slots, notes, orgIds } = parsed.data;
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_shop_id: shopId,
    p_client_request_id: clientRequestId,
    p_payment_method: paymentMethod,
    p_slots: slots,
    p_notes: notes || undefined,
    p_org_ids: orgIds,
  });
  if (error) return fail(error);
  refresh();
  // The distributor (or dukan) was notified: send the phone push after the response.
  after(flushPushOutboxQuietly);
  return { ok: true, data: placeOrderResultSchema.parse(data) };
}

const cancelInput = z.object({ orderId: z.uuid(), reason: z.string().trim().min(1).max(500) });

export async function cancelOrder(input: z.input<typeof cancelInput>): Promise<ActionResult<null>> {
  const parsed = cancelInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "reason_required" };
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_order", {
    p_order_id: parsed.data.orderId,
    p_reason: parsed.data.reason,
  });
  if (error) return fail(error);
  refresh();
  after(flushPushOutboxQuietly);
  return { ok: true, data: null };
}

export async function reorderOrder(orderId: string): Promise<ActionResult<ReorderResult>> {
  if (!z.uuid().safeParse(orderId).success) return { ok: false, error: "order_not_found" };
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("reorder", { p_order_id: orderId });
  if (error) return fail(error);
  return { ok: true, data: reorderResultSchema.parse(data) };
}

const rateInput = z.object({
  orderId: z.uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export async function rateOrder(input: z.input<typeof rateInput>): Promise<ActionResult<null>> {
  const parsed = rateInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "generic" };
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("rate_order", {
    p_order_id: parsed.data.orderId,
    p_rating: parsed.data.rating,
    p_comment: parsed.data.comment || undefined,
  });
  if (error) return fail(error);
  refresh();
  return { ok: true, data: null };
}

const returnInput = z.object({
  orderId: z.uuid(),
  items: z
    .array(
      z.object({
        orderItemId: z.uuid(),
        baseQty: z.number().int().positive(),
        reason: z.enum(["damaged", "short", "expired", "wrong_item", "quality", "other"]),
      }),
    )
    .min(1),
  notes: z.string().trim().max(1000).optional(),
});

export async function requestReturn(
  input: z.input<typeof returnInput>,
): Promise<ActionResult<{ returnNumber: string }>> {
  const parsed = returnInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "generic" };
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("request_return", {
    p_order_id: parsed.data.orderId,
    p_items: parsed.data.items.map((item) => ({
      order_item_id: item.orderItemId,
      base_qty: item.baseQty,
      reason: item.reason,
    })),
    p_notes: parsed.data.notes || undefined,
  });
  if (error) return fail(error);
  refresh();
  after(flushPushOutboxQuietly);
  return {
    ok: true,
    data: { returnNumber: z.object({ return_number: z.string() }).parse(data).return_number },
  };
}
