/**
 * Fulfilment RPCs raise a stable key as the error message. These are the keys the portal has
 * copy for (`distributor.errors.<key>`); anything else reads as a generic error.
 */
export const distributorErrorKeys = [
  "not_allowed",
  "order_not_found",
  "confirmation_required",
  "invalid_transition",
  "too_soon",
  "cannot_cancel",
  "reason_required",
  "invalid_quantity",
  "nothing_delivered",
  "cash_exceeds_due",
  "otp_invalid",
  "otp_locked",
] as const;

export type DistributorErrorKey = (typeof distributorErrorKeys)[number] | "generic" | "offline";

export function distributorErrorKey(error: unknown): DistributorErrorKey {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  return (distributorErrorKeys as readonly string[]).includes(message)
    ? (message as DistributorErrorKey)
    : "generic";
}
