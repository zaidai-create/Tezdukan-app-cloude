import type { StatusTone } from "@/components/ui/status-badge";
import type { OrderStatus } from "../schemas";

/** Order status colours: amber while in progress, green once delivered, red when it failed. */
export const statusTone: Record<OrderStatus, StatusTone> = {
  new: "warning",
  confirmed: "warning",
  picking: "warning",
  packed: "warning",
  dispatched: "warning",
  delivered: "success",
  partially_delivered: "warning",
  returned: "danger",
  cancelled: "danger",
};

/** The steps a dukandar sees on the progress timeline. */
export const progressSteps: OrderStatus[] = [
  "new",
  "confirmed",
  "packed",
  "dispatched",
  "delivered",
];

export function isOpen(status: OrderStatus): boolean {
  return ["new", "confirmed", "picking", "packed", "dispatched"].includes(status);
}
