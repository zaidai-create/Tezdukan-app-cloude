import { z } from "zod";
import { orderStatusSchema, paymentMethodSchema } from "@/features/ordering/schemas";

/**
 * Shapes of the distributor portal RPCs (supabase/migrations/20261029090100_order_fulfilment.sql).
 */

const paisa = z.number().int();
const id = z.uuid();
const timestamp = z.string().min(10);

export const shopCardSchema = z.object({
  id,
  name: z.string(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  owner_name: z.string().nullable(),
  owner_phone: z.string().nullable(),
  address_line: z.string().nullable(),
  area_name: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  photo_path: z.string().nullable(),
  tier: z.enum(["silver", "gold", "platinum"]).nullable(),
  member_since: timestamp,
});
export type ShopCard = z.infer<typeof shopCardSchema>;

export const confirmationReasonSchema = z.enum(["high_value", "first_order"]);
export type ConfirmationReason = z.infer<typeof confirmationReasonSchema>;

const confirmationFields = {
  needs_confirmation: z.boolean(),
  confirmation_reasons: z
    .array(z.string())
    .transform((reasons) =>
      reasons.filter((r): r is ConfirmationReason => confirmationReasonSchema.safeParse(r).success),
    ),
  phone_confirmed_at: timestamp.nullable(),
  shop_confirmed_at: timestamp.nullable(),
  shop_confirm_requested_at: timestamp.nullable(),
};

export const inboxOrderSchema = z.object({
  id,
  order_number: z.string(),
  status: orderStatusSchema,
  payment_method: paymentMethodSchema,
  payment_status: z.enum(["unpaid", "partially_paid", "paid", "refunded"]),
  total_paisa: paisa,
  created_at: timestamp,
  delivery_slot_start: timestamp.nullable(),
  delivery_slot_end: timestamp.nullable(),
  item_count: z.number().int(),
  shop: shopCardSchema,
  ...confirmationFields,
});
export type InboxOrder = z.infer<typeof inboxOrderSchema>;

export const inboxTabSchema = z.enum(["new", "active", "done"]);
export type InboxTab = z.infer<typeof inboxTabSchema>;

export const inboxSchema = z.object({
  counts: z.object({
    new: z.number().int(),
    needs_confirmation: z.number().int(),
    active: z.number().int(),
    done: z.number().int(),
  }),
  orders: z.array(inboxOrderSchema),
});
export type Inbox = z.infer<typeof inboxSchema>;

export const orgOrderItemSchema = z.object({
  id,
  distributor_product_id: id,
  name: z.string(),
  name_ur: z.string().nullable(),
  image_path: z.string().nullable(),
  pack_label: z.string().nullable(),
  base_qty_per_unit: z.number().int(),
  quantity: z.number().int(),
  base_qty: z.number().int(),
  unit_price_paisa: paisa,
  mrp_paisa: paisa,
  line_discount_paisa: paisa,
  line_total_paisa: paisa,
  free_base_qty: z.number().int(),
  delivered_base_qty: z.number().int().nullable(),
  short_base_qty: z.number().int(),
  available_base_qty: z.number().int().nullable(),
  reserved_base_qty: z.number().int(),
});
export type OrgOrderItem = z.infer<typeof orgOrderItemSchema>;

export const orgOrderDetailSchema = z.object({
  order: z.object({
    id,
    order_number: z.string(),
    status: orderStatusSchema,
    source: z.string(),
    payment_method: paymentMethodSchema,
    payment_status: z.enum(["unpaid", "partially_paid", "paid", "refunded"]),
    subtotal_paisa: paisa,
    scheme_discount_paisa: paisa,
    delivery_fee_paisa: paisa,
    total_paisa: paisa,
    ordered_total_paisa: paisa,
    paid_paisa: paisa,
    delivery_slot_start: timestamp.nullable(),
    delivery_slot_end: timestamp.nullable(),
    notes: z.string().nullable(),
    placed_by_name: z.string().nullable(),
    created_at: timestamp,
    confirmed_at: timestamp.nullable(),
    dispatched_at: timestamp.nullable(),
    delivered_at: timestamp.nullable(),
    cancelled_at: timestamp.nullable(),
    cancel_reason: z.string().nullable(),
    invoice_number: z.string().nullable(),
    due_date: z.string().nullable(),
    confirm_threshold_paisa: paisa,
    ...confirmationFields,
  }),
  shop: shopCardSchema,
  account: z.object({
    status: z.enum(["active", "on_hold", "blocked", "none"]),
    credit_limit_paisa: paisa,
    payment_terms_days: z.number().int(),
    balance_paisa: paisa,
    available_credit_paisa: paisa,
    overdue_paisa: paisa,
  }),
  stats: z.object({
    orders: z.number().int(),
    delivered: z.number().int(),
    cancelled: z.number().int(),
    delivered_value_paisa: paisa,
    first_order_at: timestamp.nullable(),
  }),
  items: z.array(orgOrderItemSchema),
  history: z.array(
    z.object({
      id,
      from_status: orderStatusSchema.nullable(),
      to_status: orderStatusSchema,
      changed_by_name: z.string().nullable(),
      note: z.string().nullable(),
      created_at: timestamp,
    }),
  ),
  otp: z.object({ attempts: z.number().int(), verified_at: timestamp.nullable() }).nullable(),
  can_manage: z.boolean(),
  can_deliver: z.boolean(),
});
export type OrgOrderDetail = z.infer<typeof orgOrderDetailSchema>;

export const dashboardSchema = z.object({
  today_orders: z.number().int(),
  today_value_paisa: paisa,
  new_orders: z.number().int(),
  needs_confirmation: z.number().int(),
  to_dispatch: z.number().int(),
  out_for_delivery: z.number().int(),
  delivered_today_paisa: paisa,
  receivable_paisa: paisa,
  overdue_paisa: paisa,
  active_shops: z.number().int(),
  sales_7d: z.array(z.object({ date: z.string(), value_paisa: paisa, orders: z.number().int() })),
  top_shops: z.array(
    z.object({ id, name: z.string(), value_paisa: paisa, orders: z.number().int() }),
  ),
});
export type Dashboard = z.infer<typeof dashboardSchema>;

export const insightsSchema = z.object({
  mtd: z.object({ sales_paisa: paisa, orders: z.number().int(), prev_sales_paisa: paisa }),
  pipeline: z.object({
    new: z.number().int(),
    confirmed: z.number().int(),
    picking: z.number().int(),
    packed: z.number().int(),
    dispatched: z.number().int(),
  }),
  fill_rate: z.number().nullable(),
  retailers: z.object({
    total: z.number().int(),
    active: z.number().int(),
    new: z.number().int(),
    inactive: z.number().int(),
  }),
  inactive_shops: z.array(
    z.object({
      id,
      name: z.string(),
      phone: z.string().nullable(),
      last_order_at: timestamp,
      days_quiet: z.number().int(),
    }),
  ),
  top_products: z.array(
    z.object({
      id,
      name: z.string(),
      image_path: z.string().nullable(),
      units: z.number().int(),
      value_paisa: paisa,
    }),
  ),
  categories: z.array(
    z.object({ id, name: z.string(), name_ur: z.string().nullable(), value_paisa: paisa }),
  ),
  running_low: z.array(
    z.object({
      id,
      name: z.string(),
      available_base_qty: z.number().int(),
      days_left: z.number().int(),
    }),
  ),
});
export type Insights = z.infer<typeof insightsSchema>;

export const statusResultSchema = z.object({
  id,
  status: orderStatusSchema,
  shortages: z.array(
    z.object({
      distributor_product_id: id,
      name: z.string(),
      needed: z.number().int(),
      short: z.number().int(),
    }),
  ),
});
export type StatusResult = z.infer<typeof statusResultSchema>;

export const deliveryResultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    id,
    status: orderStatusSchema,
    invoice_number: z.string(),
    total_paisa: paisa,
    paid_paisa: paisa,
  }),
  z.object({
    ok: z.literal(false),
    error: z.enum(["otp_invalid", "otp_locked"]),
    attempts_left: z.number().int(),
  }),
]);
export type DeliveryResult = z.infer<typeof deliveryResultSchema>;
