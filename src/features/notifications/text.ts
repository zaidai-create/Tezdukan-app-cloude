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
    default:
      return { title: n.title, body: n.body };
  }
}
