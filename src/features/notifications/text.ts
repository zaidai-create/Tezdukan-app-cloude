import type { useTranslations } from "next-intl";
import { formatRs } from "@/lib/money";
import type { AppNotification } from "./schemas";

type NotificationsT = ReturnType<typeof useTranslations<"notifications">>;

const str = (value: unknown): string => (typeof value === "string" ? value : "");
const num = (value: unknown): number => (typeof value === "number" ? value : Number(value) || 0);

/**
 * Notifications are written by the database in English, with the event and its facts in
 * `data`. Known events are shown in the reader's language from those facts; anything else
 * falls back to the stored text. Used for the in-app list and for push (server side).
 */
export function notificationText(
  t: NotificationsT,
  n: Pick<AppNotification, "title" | "body" | "data">,
): { title: string; body: string | null } {
  const d = n.data;
  const number = str(d.order_number);
  switch (d.event) {
    case "order.created":
      return { title: t("events.orderCreated", { number }), body: n.body };
    case "order.cancelled":
      return { title: t("events.orderCancelled", { number }), body: n.body };
    case "order.confirmed":
      return {
        title: t("events.orderConfirmed", { number }),
        body: str(d.org_name) ? t("events.orderConfirmedBody", { org: str(d.org_name) }) : n.body,
      };
    case "order.dispatched":
      return {
        title: t("events.orderDispatched", { number }),
        body: t("events.orderDispatchedBody"),
      };
    case "order.delivered":
      return {
        title: t("events.orderDelivered", { number }),
        body: t("events.orderDeliveredBody", {
          invoice: str(d.invoice_number),
          total: formatRs(num(d.total_paisa)),
        }),
      };
    case "order.confirmation_requested":
      return {
        title: t("events.confirmRequested", { number }),
        body: t("events.confirmRequestedBody", {
          org: str(d.org_name),
          total: formatRs(num(d.total_paisa)),
        }),
      };
    case "order.shop_confirmed":
      return {
        title: t("events.shopConfirmed", { shop: str(d.shop_name), number }),
        body: t("events.shopConfirmedBody"),
      };
    case "customer_order.placed":
      return {
        title: t("events.customerOrderPlaced", { number }),
        body: t("events.customerOrderPlacedBody", {
          name: str(d.customer_name),
          total: formatRs(num(d.total_paisa)),
        }),
      };
    case "customer_order.accepted":
      return { title: t("events.customerOrderAccepted", { shop: str(d.shop_name) }), body: number };
    case "customer_order.packed":
      return { title: t("events.customerOrderPacked", { number }), body: str(d.shop_name) };
    case "customer_order.out_for_delivery":
      return { title: t("events.customerOrderOnTheWay", { number }), body: str(d.shop_name) };
    case "customer_order.delivered":
      return { title: t("events.customerOrderDelivered", { number }), body: str(d.shop_name) };
    case "customer_order.rejected":
      return {
        title: t("events.customerOrderRejected", { shop: str(d.shop_name) }),
        body: str(d.reason) || number,
      };
    case "customer_order.cancelled":
      return { title: t("events.customerOrderCancelled", { number }), body: str(d.shop_name) };
    case "customer_order.cancelled_by_customer":
      return {
        title: t("events.customerOrderCancelledByCustomer", { name: str(d.customer_name), number }),
        body: null,
      };
    default:
      return { title: n.title, body: n.body };
  }
}
