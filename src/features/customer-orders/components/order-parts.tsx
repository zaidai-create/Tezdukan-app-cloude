import { Check, MapPin, Wallet } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { cn } from "cn";
import { ProductImage } from "@/components/commerce/product-image";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { storageUrl } from "@/features/ordering/images";
import { formatDateTime } from "@/lib/format";
import { formatRs } from "@/lib/money";
import { orderSteps, type CustomerOrder, type CustomerOrderStatus } from "../schemas";

export function statusTone(status: CustomerOrderStatus): StatusTone {
  if (status === "delivered") return "success";
  if (status === "cancelled" || status === "rejected") return "danger";
  return "warning";
}

export async function OrderStatusBadge({ status }: { status: CustomerOrderStatus }) {
  const t = await getTranslations("customerOrders.status");
  return <StatusBadge tone={statusTone(status)}>{t(status)}</StatusBadge>;
}

const stepTime = (order: CustomerOrder, step: CustomerOrderStatus) =>
  ({
    placed: order.created_at,
    accepted: order.accepted_at,
    packed: order.packed_at,
    out_for_delivery: order.out_for_delivery_at,
    delivered: order.delivered_at,
    cancelled: order.cancelled_at,
    rejected: null,
  })[step];

/** Placed, accepted, packed, on the way, delivered: done steps ticked, the next one waiting. */
export async function OrderProgress({ order }: { order: CustomerOrder }) {
  const t = await getTranslations("customerOrders");
  if (order.status === "cancelled" || order.status === "rejected") {
    const reason = order.status === "rejected" ? order.rejected_reason : order.cancel_reason;
    return (
      <div className="rounded-lg bg-danger-soft px-4 py-3 text-danger-ink">
        <p className="font-semibold">{t(`status.${order.status}`)}</p>
        {reason ? <p className="text-sm">{reason}</p> : null}
      </div>
    );
  }
  const reached = orderSteps.indexOf(order.status);
  return (
    <ol className="flex flex-col">
      {orderSteps.map((step, index) => {
        const done = index <= reached;
        const at = stepTime(order, step);
        return (
          <li key={step} className="flex gap-3">
            <span className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border-2",
                  done
                    ? "border-primary bg-primary text-on-action"
                    : "border-border bg-surface text-muted",
                )}
              >
                {done ? <Check aria-hidden className="size-4" strokeWidth={2.5} /> : null}
              </span>
              {index < orderSteps.length - 1 ? (
                <span
                  className={cn("w-0.5 flex-1", index < reached ? "bg-primary" : "bg-border")}
                />
              ) : null}
            </span>
            <span className="pb-4">
              <span className={cn("block font-semibold", done ? "text-ink" : "text-muted")}>
                {t(`status.${step}`)}
              </span>
              {done && at ? (
                <span className="num block text-sm text-muted">{formatDateTime(at)}</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** The lines and the bill. */
export async function OrderSummary({ order }: { order: CustomerOrder }) {
  const [t, locale] = await Promise.all([getTranslations("customerOrders"), getLocale()]);
  return (
    <section className="overflow-hidden rounded-lg border border-border/60 bg-surface shadow-card">
      <ul className="divide-y divide-border/70">
        {(order.customer_order_items ?? []).map((item) => {
          const name = locale === "ur" && item.name_ur ? item.name_ur : item.name;
          return (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
              <ProductImage
                src={storageUrl(item.image_path)}
                alt={name}
                className="size-14 shrink-0 rounded-md"
              />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold text-pretty text-ink">{name}</p>
                <p className="num text-sm text-muted">
                  {item.qty} × {formatRs(item.unit_price_paisa)}
                </p>
              </div>
              <p className="num font-semibold text-ink">{formatRs(item.line_total_paisa)}</p>
            </li>
          );
        })}
      </ul>
      <dl className="num flex flex-col gap-1.5 border-t border-border/70 px-4 py-3 text-base">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">{t("itemTotal")}</dt>
          <dd className="text-ink">{formatRs(order.subtotal_paisa)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">{t("delivery")}</dt>
          <dd className="text-ink">
            {order.delivery_fee_paisa === 0 ? t("free") : formatRs(order.delivery_fee_paisa)}
          </dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-border/70 pt-2 font-heading text-lg font-bold">
          <dt className="text-ink">{t("total")}</dt>
          <dd className="text-ink">{formatRs(order.total_paisa)}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-2 border-t border-border/70 px-4 py-3 text-sm">
        {order.delivery_address?.text ? (
          <p className="flex items-start gap-2 text-ink">
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{order.delivery_address.text}</span>
          </p>
        ) : null}
        <p className="flex items-center gap-2 text-ink">
          <Wallet aria-hidden className="size-4 shrink-0 text-primary" />
          {t("cod")}
          {order.payment_status === "paid" ? ` · ${t("paid")}` : null}
        </p>
      </div>
    </section>
  );
}
