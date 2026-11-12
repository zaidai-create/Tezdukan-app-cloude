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
  // A snapshot of the address at order time; the pin is there for orders since Nov 2026.
  delivery_address: z
    .object({
      text: z.string().optional(),
      label: z.string().optional(),
      landmark: z.string().optional(),
      lat: z.coerce.number().optional(),
      lng: z.coerce.number().optional(),
    })
    .nullable(),
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
  // What the customer wants when an item is missing (orders before Nov 2026 read "call_me").
  if_unavailable: z.enum(["call_me", "replace", "remove"]).catch("call_me").default("call_me"),
});
export type CustomerOrder = z.infer<typeof customerOrderSchema>;

export const problemReasons = ["missing_item", "damaged", "wrong_item", "late", "other"] as const;
export type ProblemReason = (typeof problemReasons)[number];

/** A line the dukan removed or replaced, as it was. */
export const orderChangeSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["removed", "replaced"]),
  item_name: z.string(),
  item_name_ur: z.string().nullable(),
  qty: z.coerce.number(),
  line_total_paisa: z.number().int(),
  new_name: z.string().nullable(),
  new_name_ur: z.string().nullable(),
  new_line_total_paisa: z.number().int().nullable(),
  created_at: z.string(),
});
export type OrderChange = z.infer<typeof orderChangeSchema>;

/** A product of the same dukan that can stand in for a missing line. */
export const replacementSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  name_ur: z.string().nullable(),
  pack_size_label: z.string().nullable(),
  selling_price_paisa: z.number().int(),
  image_path: z.string().nullable(),
  same_category: z.boolean(),
});
export type Replacement = z.infer<typeof replacementSchema>;

export const ORDER_COLUMNS =
  "id, order_number, shop_id, shop_name, customer_name, customer_phone, status, payment_method, payment_status, items_count, subtotal_paisa, delivery_fee_paisa, total_paisa, delivery_address, notes, rejected_reason, cancel_reason, created_at, accepted_at, packed_at, out_for_delivery_at, delivered_at, cancelled_at, if_unavailable";
export const ITEM_COLUMNS =
  "customer_order_items (id, name, name_ur, image_path, qty, unit_price_paisa, line_total_paisa)";

export const placeOrderSchema = z.object({
  shopId: z.uuid(),
  items: z
    .array(z.object({ inventoryId: z.uuid(), qty: z.number().int().min(1).max(999) }))
    .min(1)
    .max(100),
  /** The saved address the order goes to (it carries the map pin). */
  addressId: z.uuid(),
  note: z.string().trim().max(300).optional(),
  requestId: z.uuid(),
  ifUnavailable: z.enum(["call_me", "replace", "remove"]).default("call_me"),
});
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

export const orderErrors = [
  "shop_not_taking_orders",
  "empty_order",
  "address_required",
  "address_location_required",
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
  "last_item",
  "replacement_costs_more",
  "customer_wants_removal",
  "item_not_found",
  "invalid_reason",
  "details_required",
  "rate_limited",
  "reason_required",
  "too_late_to_cancel",
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
