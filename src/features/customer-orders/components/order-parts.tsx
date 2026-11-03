import {
  Bike,
  Check,
  ChevronRight,
  Clock3,
  MapPin,
  Package,
  PartyPopper,
  Store,
  Wallet,
  X,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { cn } from "cn";
import { ProductImage } from "@/components/commerce/product-image";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { storageUrl } from "@/features/ordering/images";
import { Link } from "@/i18n/navigation";
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

const heroIcon = {
  placed: Clock3,
  accepted: Store,
  packed: Package,
  out_for_delivery: Bike,
  delivered: PartyPopper,
  cancelled: X,
  rejected: X,
} as const;

/**
 * The top of the tracking screen: where the order is now in one big line, how long it
 * usually takes, and the five steps as a capsule progress bar.
 */
export async function OrderHero({
  order,
  etaMinutes,
}: {
  order: CustomerOrder;
  etaMinutes: number | null;
}) {
  const t = await getTranslations("customerOrders");
  const ended = order.status === "cancelled" || order.status === "rejected";
  const reached = orderSteps.indexOf(order.status);
  const Icon = heroIcon[order.status];
  const active = !ended && order.status !== "delivered";
  return (
    <section
      className={cn(
        "sheen relative overflow-hidden rounded-xl p-5 shadow-raised inset-shadow-edge",
        ended ? "bg-danger-soft text-danger-ink" : "bg-forest text-on-forest",
      )}
    >
      <div className="flex items-center gap-4">
        <span
          className={cn(
            "flex size-14 shrink-0 items-center justify-center rounded-full",
            ended ? "bg-surface text-danger-ink" : "bg-mint text-forest",
          )}
        >
          <Icon aria-hidden className="size-7" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="font-heading text-xl leading-tight font-extrabold text-pretty">
            {t(`hero.${order.status}`, { shop: order.shop_name })}
          </p>
          {active && etaMinutes ? (
            <p className="num mt-1 text-sm opacity-85">{t("eta", { minutes: etaMinutes })}</p>
          ) : null}
        </div>
      </div>
      {ended ? null : (
        <ol className="mt-5 grid grid-cols-5 gap-1.5" aria-label={t(`status.${order.status}`)}>
          {orderSteps.map((step, index) => (
            <li
              key={step}
              className={cn(
                "h-1.5 rounded-full transition-colors duration-200",
                index <= reached ? "bg-mint" : "bg-on-forest/20",
                index === reached && active && "motion-safe:animate-pulse",
              )}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

/** Home's live card for an order on its way: where it is, the five steps, and Track. */
export async function ActiveOrderCard({ order }: { order: CustomerOrder }) {
  const t = await getTranslations("customerOrders");
  const reached = orderSteps.indexOf(order.status);
  const Icon = heroIcon[order.status];
  return (
    <Link
      href={`/orders/${order.id}`}
      className="sheen flex flex-col gap-3 rounded-xl bg-forest p-4 text-on-forest shadow-raised inset-shadow-edge transition-transform duration-150 ease-out active:scale-[0.99]"
    >
      <span className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-mint text-forest">
          <Icon aria-hidden className="size-5" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold tracking-wide text-on-forest/75 uppercase">
            {t("liveOrder", { shop: order.shop_name })}
          </span>
          <span className="block font-heading text-lg leading-tight font-bold">
            {t(`liveStatus.${order.status}`)}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-mint px-3 py-1.5 text-sm font-bold text-forest">
          {t("track")}
          <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
        </span>
      </span>
      <span className="grid grid-cols-5 gap-1.5" aria-hidden>
        {orderSteps.map((step, index) => (
          <span
            key={step}
            className={cn(
              "h-1.5 rounded-full",
              index <= reached ? "bg-mint" : "bg-on-forest/20",
              index === reached && "motion-safe:animate-pulse",
            )}
          />
        ))}
      </span>
    </Link>
  );
}
