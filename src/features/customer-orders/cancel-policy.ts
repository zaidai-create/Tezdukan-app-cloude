import type { CustomerOrder } from "./schemas";

/**
 * How long after the dukan accepts the customer may still cancel (with a reason), as long as it
 * is not packed. The database enforces the same window in `update_customer_order_status`
 * (migration 20261112120000_customer_cancel_window.sql); change both together.
 */
export const CANCEL_GRACE_MS = 2 * 60 * 1000;

export type CancelState =
  /** Not accepted yet: cancel freely. */
  | { kind: "free" }
  /** Accepted moments ago: cancel with a reason until `endsAt` (ms since epoch). */
  | { kind: "grace"; endsAt: number }
  /** Packed, on the way, or the grace window has passed: call the dukan instead. */
  | { kind: "too_late" }
  /** Finished (delivered, cancelled, rejected): nothing to cancel. */
  | { kind: "none" };

export function cancelStateOf(
  order: Pick<CustomerOrder, "status" | "accepted_at">,
  now: number,
): CancelState {
  switch (order.status) {
    case "placed":
      return { kind: "free" };
    case "accepted": {
      const accepted = order.accepted_at ? Date.parse(order.accepted_at) : Number.NaN;
      const endsAt = accepted + CANCEL_GRACE_MS;
      return Number.isFinite(endsAt) && endsAt > now
        ? { kind: "grace", endsAt }
        : { kind: "too_late" };
    }
    case "packed":
    case "out_for_delivery":
      return { kind: "too_late" };
    default:
      return { kind: "none" };
  }
}

/** Reasons offered when cancelling; the chosen one goes to the dukan in its own words. */
export const cancelReasons = [
  "mistake",
  "change_items",
  "wrong_address",
  "too_long",
  "other",
] as const;
export type CancelReason = (typeof cancelReasons)[number];
