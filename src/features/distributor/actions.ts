"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { flushPushOutboxQuietly } from "@/features/notifications/dispatch";
import { orderStatusSchema } from "@/features/ordering/schemas";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { distributorErrorKey, type DistributorErrorKey } from "./errors";
import {
  deliveryResultSchema,
  statusResultSchema,
  type DeliveryResult,
  type StatusResult,
} from "./schemas";

/**
 * Distributor order actions. Each validates its input, calls one atomic RPC as the signed-in
 * member, refreshes the screen and, when the dukandar was notified, sends the phone push
 * after the response.
 */

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: DistributorErrorKey };

const fail = (error: unknown): { ok: false; error: DistributorErrorKey } => ({
  ok: false,
  error: distributorErrorKey(error),
});

const statusInput = z.object({
  orderId: z.uuid(),
  to: orderStatusSchema.extract(["confirmed", "picking", "packed", "dispatched"]),
  note: z.string().trim().max(500).optional(),
  phoneConfirmed: z.boolean().optional(),
});

export async function updateOrderStatus(
  input: z.input<typeof statusInput>,
): Promise<ActionResult<StatusResult>> {
  const parsed = statusInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "generic" };
  const { orderId, to, note, phoneConfirmed } = parsed.data;
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("update_order_status", {
    p_order_id: orderId,
    p_to_status: to,
    p_note: note || undefined,
    p_phone_confirmed: phoneConfirmed ?? false,
  });
  if (error) return fail(error);
  refresh();
  after(flushPushOutboxQuietly);
  return { ok: true, data: statusResultSchema.parse(data) };
}

export async function requestShopConfirmation(orderId: string): Promise<ActionResult<null>> {
  if (!z.uuid().safeParse(orderId).success) return { ok: false, error: "order_not_found" };
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("request_shop_confirmation", { p_order_id: orderId });
  if (error) return fail(error);
  refresh();
  after(flushPushOutboxQuietly);
  return { ok: true, data: null };
}

const deliveryInput = z.object({
  orderId: z.uuid(),
  otp: z
    .string()
    .trim()
    .regex(/^\d{4}$/),
  cashPaisa: z.number().int().min(0),
  lines: z
    .array(z.object({ orderItemId: z.uuid(), deliveredBaseQty: z.number().int().min(0) }))
    .optional(),
});

export async function confirmDelivery(
  input: z.input<typeof deliveryInput>,
): Promise<ActionResult<DeliveryResult>> {
  const parsed = deliveryInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "otp_invalid" };
  const { orderId, otp, cashPaisa, lines } = parsed.data;
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("confirm_delivery", {
    p_order_id: orderId,
    p_otp: otp,
    p_cash_collected_paisa: cashPaisa,
    p_lines: lines?.length
      ? lines.map((line) => ({
          order_item_id: line.orderItemId,
          delivered_base_qty: line.deliveredBaseQty,
        }))
      : undefined,
  });
  if (error) return fail(error);
  const result = deliveryResultSchema.parse(data);
  if (result.ok) {
    refresh();
    after(flushPushOutboxQuietly);
  }
  return { ok: true, data: result };
}

const rejectInput = z.object({ orderId: z.uuid(), reason: z.string().trim().min(1).max(500) });

/** Rejecting or cancelling as the distributor (any time before delivery). */
export async function cancelAsDistributor(
  input: z.input<typeof rejectInput>,
): Promise<ActionResult<null>> {
  const parsed = rejectInput.safeParse(input);
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
