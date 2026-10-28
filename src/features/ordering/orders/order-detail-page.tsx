import { cn } from "cn";
import {
  ArrowLeft,
  Banknote,
  CalendarClock,
  Check,
  Gift,
  KeyRound,
  MessageCircle,
  MessageSquareText,
  Phone,
  Store,
  UserRound,
  X,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { ProductImage } from "@/components/commerce/product-image";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import { formatDateTime, formatTime } from "@/lib/format";
import { telHref, whatsappHref } from "@/lib/contact";
import { formatRs } from "@/lib/money";
import { getOrder, requireDukan } from "../data";
import { storageUrl } from "../images";
import { deliveryDay, localName, ltr, slotWindow } from "../labels";
import type { OrderStatus, StatusHistoryRow } from "../schemas";
import { OrderActions } from "./order-actions";
import { ShopConfirm } from "./shop-confirm";
import { isOpen, progressSteps, statusTone } from "./status";

type Props = { params: Promise<{ id: string }> };

function OrderSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5" aria-hidden>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-28 w-full rounded-lg" />
      <Skeleton className="h-56 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}

/** Each progress step with the time it was reached; "delivered" also covers partial delivery. */
function stepTimes(history: StatusHistoryRow[]): Map<OrderStatus, string> {
  const times = new Map<OrderStatus, string>();
  for (const row of history) {
    const status = row.to_status === "partially_delivered" ? "delivered" : row.to_status;
    if (!times.has(status)) times.set(status, row.created_at);
    // Picking counts as confirmed for the dukandar's timeline.
    if (status === "picking" && !times.has("confirmed")) times.set("confirmed", row.created_at);
  }
  return times;
}

async function OrderContent({ params }: Props) {
  await connection();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { shopId } = await requireDukan(`/dukan/orders/${id}`);
  const [{ order, items, history, otp }, t, locale] = await Promise.all([
    getOrder(shopId, id),
    getTranslations("ordering"),
    getLocale(),
  ]);
  const cancelled = order.status === "cancelled";
  const times = stepTimes(history);
  const reached = progressSteps.filter((step) => times.has(step));
  const current = reached.at(-1);
  const restated = order.ordered_total_paisa !== order.total_paisa;
  const orgPhone = telHref(order.organizations?.phone);
  const orgWhatsapp = whatsappHref(
    order.organizations?.phone,
    t("order.orderNumber", { number: order.order_number }),
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5">
      <header className="flex items-center gap-3">
        <Link
          href="/dukan/orders"
          aria-label={t("orders.title")}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface shadow-card"
        >
          <ArrowLeft aria-hidden className="size-5 rtl:-scale-x-100" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="num font-heading text-2xl leading-tight font-extrabold text-ink">
            {t("order.orderNumber", { number: order.order_number })}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="flex min-w-0 items-center gap-1.5">
              <Store aria-hidden className="size-4 shrink-0" />
              <span className="truncate">{order.organizations?.name}</span>
            </span>
            <StatusBadge tone={statusTone[order.status]}>{t(`status.${order.status}`)}</StatusBadge>
          </p>
        </div>
      </header>

      {order.status === "new" && (order.needs_confirmation || order.shop_confirm_requested_at) ? (
        <ShopConfirm
          orderId={order.id}
          orgName={order.organizations?.name ?? ""}
          totalPaisa={order.total_paisa}
          requestedAt={order.shop_confirm_requested_at}
          confirmedAt={order.shop_confirmed_at}
        />
      ) : null}

      {otp && isOpen(order.status) ? (
        <section className="sheen flex items-center gap-4 rounded-xl bg-forest p-4 text-on-forest shadow-raised inset-shadow-edge">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-on-forest/12">
            <KeyRound aria-hidden className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-on-forest/85">{t("order.deliveryCode")}</p>
            <p className="text-xs text-on-forest/70">{t("order.deliveryCodeHint")}</p>
          </div>
          <p dir="ltr" className="num font-heading text-4xl font-extrabold tracking-[0.2em]">
            {otp.code}
          </p>
        </section>
      ) : null}

      <section className="rounded-lg border border-border/70 bg-surface p-4 shadow-card">
        <h2 className="mb-3 font-heading text-lg font-bold text-ink">{t("order.progress")}</h2>
        {cancelled ? (
          <div className="flex items-start gap-3 rounded-md bg-danger-soft p-3">
            <X aria-hidden className="mt-0.5 size-5 shrink-0 text-danger-ink" />
            <div>
              <p className="font-semibold text-danger-ink">{t("status.cancelled")}</p>
              {order.cancel_reason ? (
                <p className="text-sm text-ink">
                  {t("order.cancelledReason", { reason: order.cancel_reason })}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <ol className="flex flex-col">
            {progressSteps.map((step, index) => {
              const at = times.get(step);
              const done = Boolean(at);
              const isCurrent = step === current && isOpen(order.status);
              const last = index === progressSteps.length - 1;
              const label =
                step === "delivered" && order.status === "partially_delivered"
                  ? t("status.partially_delivered")
                  : t(`status.${step}`);
              return (
                <li key={step} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full border-2",
                        done
                          ? "border-primary bg-primary text-on-action"
                          : "border-border-strong/50 bg-surface",
                        isCurrent && "ring-4 ring-primary-soft",
                      )}
                    >
                      {done ? <Check aria-hidden className="size-4 stroke-[3]" /> : null}
                    </span>
                    {last ? null : (
                      <span
                        className={cn(
                          "my-1 w-0.5 flex-1 rounded-full",
                          done ? "bg-primary" : "bg-border",
                        )}
                      />
                    )}
                  </div>
                  <div className={cn("pb-5", last && "pb-0")}>
                    <p className={cn("font-semibold", done ? "text-ink" : "text-muted")}>{label}</p>
                    {at ? (
                      <p className="num text-sm text-muted">{ltr(formatDateTime(at))}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {orgPhone ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted">
            {t("order.contact", { org: order.organizations?.name ?? "" })}
          </h2>
          <div className="flex gap-2">
            <a
              href={orgPhone}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-surface text-sm font-semibold text-ink shadow-card"
            >
              <Phone aria-hidden className="size-5 text-primary-strong" />
              {t("order.call")}
            </a>
            {orgWhatsapp ? (
              <a
                href={orgWhatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-surface text-sm font-semibold text-ink shadow-card"
              >
                <MessageCircle aria-hidden className="size-5 text-primary-strong" />
                {t("order.whatsapp")}
              </a>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="num grid gap-3 rounded-lg border border-border/70 bg-surface p-4 text-sm shadow-card sm:grid-cols-2">
        {order.delivery_slot_start && order.delivery_slot_end ? (
          <p className="flex items-start gap-2">
            <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
            <span>
              <span className="block text-muted">{t("order.slot")}</span>
              <span className="font-semibold text-ink">
                {`${deliveryDay(t, order.delivery_slot_start)}, ${slotWindow(t, order.delivery_slot_start, order.delivery_slot_end)}`}
              </span>
            </span>
          </p>
        ) : null}
        <p className="flex items-start gap-2">
          <Banknote aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
          <span>
            <span className="block text-muted">{t("order.paymentLabel")}</span>
            <span className="font-semibold text-ink">
              {t(`payment.${order.payment_method}`)} · {t(`payment.${order.payment_status}`)}
            </span>
          </span>
        </p>
        {order.placed_by_name ? (
          <p className="flex items-start gap-2">
            <UserRound aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
            <span className="text-ink">
              {order.source === "booker"
                ? t("orders.viaBooker", { name: order.placed_by_name })
                : t("order.placedBy", { name: order.placed_by_name })}
              <span className="block text-muted">{ltr(formatTime(order.created_at))}</span>
            </span>
          </p>
        ) : null}
        {order.notes ? (
          <p className="flex items-start gap-2 sm:col-span-2">
            <MessageSquareText aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
            <span>
              <span className="block text-muted">{t("order.notes")}</span>
              <span className="text-ink">{order.notes}</span>
            </span>
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-border/70 bg-surface shadow-card">
        <h2 className="px-4 pt-4 font-heading text-lg font-bold text-ink">
          {t("order.items")}{" "}
          <span className="num text-sm font-normal text-muted">({items.length})</span>
        </h2>
        <ul className="divide-y divide-border/70 px-4">
          {items.map((item) => {
            const name = localName(item, locale);
            const ordered = item.base_qty ?? item.quantity * item.base_qty_per_unit;
            return (
              <li key={item.id} className="flex gap-3 py-3">
                <ProductImage
                  src={storageUrl(item.image_path)}
                  alt={name}
                  sizes="56px"
                  className="size-14 shrink-0 rounded-md"
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold text-ink">{name}</p>
                  <p className="num text-xs text-muted">
                    {item.quantity} × {item.pack_label} · {formatRs(item.unit_price_paisa)}
                  </p>
                  {item.free_base_qty > 0 ? (
                    <p className="num mt-0.5 flex items-center gap-1 text-xs font-bold text-primary-strong">
                      <Gift aria-hidden className="size-3.5" />
                      {t("cart.free", { count: item.free_base_qty })}
                    </p>
                  ) : null}
                  {item.delivered_base_qty !== null && item.delivered_base_qty < ordered ? (
                    <p className="num mt-0.5 text-xs font-semibold text-awning-ink">
                      {t("order.deliveredQty", { count: item.delivered_base_qty, total: ordered })}
                    </p>
                  ) : null}
                </div>
                <p className="num shrink-0 font-semibold text-ink">
                  {formatRs(item.line_total_paisa)}
                </p>
              </li>
            );
          })}
        </ul>
        <dl className="num flex flex-col gap-1.5 border-t border-border/70 p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">{t("cart.subtotal")}</dt>
            <dd className="text-ink">{formatRs(order.subtotal_paisa)}</dd>
          </div>
          {order.scheme_discount_paisa > 0 ? (
            <div className="flex justify-between">
              <dt className="text-muted">{t("cart.schemeDiscount")}</dt>
              <dd className="font-semibold text-primary-strong">
                {formatRs(-order.scheme_discount_paisa)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-muted">{t("cart.deliveryFee")}</dt>
            <dd className="text-ink">
              {order.delivery_fee_paisa === 0
                ? t("cart.deliveryFree")
                : formatRs(order.delivery_fee_paisa)}
            </dd>
          </div>
          <div className="mt-1 flex justify-between font-heading text-lg font-extrabold text-ink">
            <dt>{t("cart.total")}</dt>
            <dd>
              {restated ? (
                <s className="me-2 text-sm font-normal text-muted">
                  {formatRs(order.ordered_total_paisa)}
                </s>
              ) : null}
              {formatRs(order.total_paisa)}
            </dd>
          </div>
        </dl>
      </section>

      <OrderActions
        shopId={shopId}
        order={{
          id: order.id,
          orgName: order.organizations?.name ?? "",
          status: order.status,
          rating: order.rating,
          deliveredAt: order.delivered_at,
        }}
        items={items.map((item) => ({
          id: item.id,
          name: localName(item, locale),
          maxQty:
            (item.delivered_base_qty ?? item.base_qty ?? item.quantity * item.base_qty_per_unit) +
            item.free_base_qty,
        }))}
      />
    </div>
  );
}

/** One order: delivery code, live progress, items, bill and what the dukandar can do next. */
export function OrderDetailPage(props: Props) {
  return (
    <Suspense fallback={<OrderSkeleton />}>
      <OrderContent {...props} />
    </Suspense>
  );
}
