import { z } from "zod";

export const customerOrderStatuses = [
  "placed",
  "accepted",
  "packed",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "rejected",
] as const;
export type CustomerOrderStatus = (typeof customerOrderStatuses)[number];

/** The happy path, for the progress steps. */
export const orderSteps: readonly CustomerOrderStatus[] = [
  "placed",
  "accepted",
  "packed",
  "out_for_delivery",
  "delivered",
];

export const customerOrderItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  name_ur: z.string().nullable(),
  image_path: z.string().nullable(),
  qty: z.coerce.number(),
  unit_price_paisa: z.number().int(),
  line_total_paisa: z.number().int(),
});
export type CustomerOrderItem = z.infer<typeof customerOrderItemSchema>;

export const customerOrderSchema = z.object({
  id: z.uuid(),
  order_number: z.string(),
  shop_id: z.uuid(),
  shop_name: z.string(),
  customer_name: z.string().nullable(),
  customer_phone: z.string().nullable(),
  status: z.enum(customerOrderStatuses),
  payment_method: z.string(),
  payment_status: z.string(),
  items_count: z.number().int(),
  subtotal_paisa: z.number().int(),
  delivery_fee_paisa: z.number().int(),
  total_paisa: z.number().int(),
  delivery_address: z.object({ text: z.string().optional() }).nullable(),
  notes: z.string().nullable(),
  rejected_reason: z.string().nullable(),
  cancel_reason: z.string().nullable(),
  created_at: z.string(),
  accepted_at: z.string().nullable(),
  packed_at: z.string().nullable(),
  out_for_delivery_at: z.string().nullable(),
  delivered_at: z.string().nullable(),
  cancelled_at: z.string().nullable(),
  customer_order_items: z.array(customerOrderItemSchema).optional(),
});
export type CustomerOrder = z.infer<typeof customerOrderSchema>;

export const ORDER_COLUMNS =
  "id, order_number, shop_id, shop_name, customer_name, customer_phone, status, payment_method, payment_status, items_count, subtotal_paisa, delivery_fee_paisa, total_paisa, delivery_address, notes, rejected_reason, cancel_reason, created_at, accepted_at, packed_at, out_for_delivery_at, delivered_at, cancelled_at";
export const ITEM_COLUMNS =
  "customer_order_items (id, name, name_ur, image_path, qty, unit_price_paisa, line_total_paisa)";

export const placeOrderSchema = z.object({
  shopId: z.uuid(),
  items: z
    .array(z.object({ inventoryId: z.uuid(), qty: z.number().int().min(1).max(999) }))
    .min(1)
    .max(100),
  address: z.string().trim().min(5).max(300),
  note: z.string().trim().max(300).optional(),
  requestId: z.uuid(),
});
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

export const orderErrors = [
  "shop_not_taking_orders",
  "empty_order",
  "address_required",
  "invalid_quantity",
  "item_unavailable",
  "out_of_stock",
  "below_minimum",
  "invalid_transition",
  "not_allowed",
  "order_not_found",
  "not_delivered",
  "invalid_rating",
  "out_of_area",
  "generic",
] as const;
export type OrderError = (typeof orderErrors)[number];

export function orderErrorKey(message: string | undefined): OrderError {
  return orderErrors.find((key) => key === message) ?? "generic";
}

export type InboxTab = "new" | "active" | "done";
export const tabStatuses: Record<InboxTab, readonly CustomerOrderStatus[]> = {
  new: ["placed"],
  active: ["accepted", "packed", "out_for_delivery"],
  done: ["delivered", "cancelled", "rejected"],
};
