/**
 * Ordering RPCs raise a stable key as the error message (see rpc_internals). These are the
 * keys the app has copy for (`ordering.errors.<key>`); anything else reads as a generic error.
 */
export const orderingErrorKeys = [
  "not_allowed",
  "shop_not_available",
  "product_unavailable",
  "invalid_pack_unit",
  "invalid_quantity",
  "cart_empty",
  "below_minimum",
  "slot_unavailable",
  "account_blocked",
  "account_on_hold",
  "credit_limit_exceeded",
  "out_of_stock",
  "insufficient_stock",
  "cannot_cancel",
  "reason_required",
  "already_rated",
  "not_delivered",
  "return_window_closed",
  "return_exceeds_delivered",
  "order_not_found",
] as const;

export type OrderingErrorKey = (typeof orderingErrorKeys)[number] | "generic" | "offline";

export function orderingErrorKey(error: unknown): OrderingErrorKey {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  return (orderingErrorKeys as readonly string[]).includes(message)
    ? (message as OrderingErrorKey)
    : "generic";
}
