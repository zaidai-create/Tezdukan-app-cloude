import { cn } from "cn";
import {
  ArrowLeft,
  Banknote,
  CalendarClock,
  Gift,
  MessageSquareText,
  Receipt,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { ProductImage } from "@/components/commerce/product-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { storageUrl } from "@/features/ordering/images";
import { deliveryDay, localName, ltr, slotWindow } from "@/features/ordering/labels";
import { isOpen, statusTone } from "@/features/ordering/orders/status";
import { Link } from "@/i18n/navigation";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatRs } from "@/lib/money";
import { formatPkMobile } from "@/lib/phone";
import { ShopContact } from "../components/shop-contact";
import { getOrgOrder, requireDistributor } from "../data";
import { OrderActionBar, OrderConfirmation, OrderWorkflow } from "./order-workflow";

type Props = { params: Promise<{ id: string }> };

function OrderSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5" aria-hidden>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}

async function OrderContent({ params }: Props) {
  await connection();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  await requireDistributor(`/distributor/orders/${id}`);
  const [detail, t, tOrdering, locale] = await Promise.all([
    getOrgOrder(id),
    getTranslations("distributor.order"),
    getTranslations("ordering"),
    getLocale(),
  ]);
  const { order, shop, account, stats, items, history } = detail;
  const contactName = shop.owner_name?.split(" ")[0] || shop.name;
  const phone = shop.phone ?? shop.owner_phone;
  const active = isOpen(order.status);
  const due = order.total_paisa - order.paid_paisa;
  const restated = order.ordered_total_paisa !== order.total_paisa;

  return (
    <OrderWorkflow
      order={{
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        paymentMethod: order.payment_method,
        totalPaisa: order.total_paisa,
        paidPaisa: order.paid_paisa,
        needsConfirmation: order.needs_confirmation,
        reasons: order.confirmation_reasons,
        thresholdPaisa: order.confirm_threshold_paisa,
        phoneConfirmedAt: order.phone_confirmed_at,
        shopConfirmedAt: order.shop_confirmed_at,
        shopConfirmRequestedAt: order.shop_confirm_requested_at,
      }}
      shop={{ name: shop.name, contactName, phone }}
      items={items.map((item) => ({
        id: item.id,
        name: localName(item, locale),
        baseQty: item.base_qty,
        piecePricePaisa: item.base_qty_per_unit
          ? Math.round(item.unit_price_paisa / item.base_qty_per_unit)
          : 0,
        freeBaseQty: item.free_base_qty,
      }))}
      canManage={detail.can_manage}
      canDeliver={detail.can_deliver}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5">
        <header className="flex items-center gap-3">
          <Link
            href="/distributor/orders"
            aria-label={t("back")}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface shadow-card"
          >
            <ArrowLeft aria-hidden className="size-5 rtl:-scale-x-100" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="num font-heading text-2xl leading-tight font-extrabold text-ink">
              {t("title", { number: order.order_number })}
            </h1>
            <p className="num mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <StatusBadge tone={statusTone[order.status]}>
                {tOrdering(`status.${order.status}`)}
              </StatusBadge>
              {ltr(formatDateTime(order.created_at))}
            </p>
          </div>
        </header>

        <OrderConfirmation />

        {order.status === "cancelled" && order.cancel_reason ? (
          <p className="rounded-md bg-danger-soft p-3 text-sm font-semibold text-danger-ink">
            {t("cancelled", { reason: order.cancel_reason })}
          </p>
        ) : null}

        <section className="flex flex-col gap-4 rounded-lg border border-border/70 bg-surface p-4 shadow-card">
          <div className="flex items-start gap-3">
            <Avatar className="size-14 rounded-lg">
              {shop.photo_path ? (
                <AvatarImage src={storageUrl(shop.photo_path, "shop-media") ?? undefined} alt="" />
              ) : null}
              <AvatarFallback name={shop.name} className="rounded-lg text-base" />
            </Avatar>
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-heading text-lg font-bold text-ink">{shop.name}</h2>
              <p className="text-sm text-muted">
                {shop.owner_name}
                {shop.owner_name && phone ? " · " : null}
                {phone ? (
                  <bdi dir="ltr" className="num whitespace-nowrap">
                    {formatPkMobile(phone)}
                  </bdi>
                ) : null}
              </p>
              <p className="text-sm text-muted">
                {shop.area_name && !shop.address_line?.includes(shop.area_name)
                  ? [shop.address_line, shop.area_name].filter(Boolean).join(", ")
                  : shop.address_line}
              </p>
            </div>
            {shop.tier ? (
              <StatusBadge tone="neutral" icon={null}>
                {t(`shop.tier.${shop.tier}`)}
              </StatusBadge>
            ) : null}
          </div>
          <ShopContact
            shop={shop}
            chatHref={`/distributor/chat/with/${shop.id}`}
            whatsappText={tOrdering("order.orderNumber", { number: order.order_number })}
          />
          <dl className="num grid grid-cols-2 gap-x-4 gap-y-2 rounded-md bg-subtle p-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted">{t("shop.creditLimit")}</dt>
              <dd className="font-semibold text-ink">{formatRs(account.credit_limit_paisa)}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("shop.balance")}</dt>
              <dd className="font-semibold text-ink">{formatRs(account.balance_paisa)}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("shop.available")}</dt>
              <dd className="font-semibold text-ink">{formatRs(account.available_credit_paisa)}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("shop.overdue")}</dt>
              <dd
                className={cn(
                  "font-semibold",
                  account.overdue_paisa > 0 ? "text-danger-ink" : "text-ink",
                )}
              >
                {formatRs(account.overdue_paisa)}
              </dd>
            </div>
          </dl>
          <p className="num flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span>{t("shop.orders", { orders: stats.orders, delivered: stats.delivered })}</span>
            <span>{t("shop.since", { date: ltr(formatDate(shop.member_since)) })}</span>
            <StatusBadge
              tone={
                account.status === "active"
                  ? "success"
                  : account.status === "none"
                    ? "neutral"
                    : "danger"
              }
            >
              {t(`shop.accountStatus.${account.status}`)}
            </StatusBadge>
          </p>
        </section>

        <section className="num grid gap-3 rounded-lg border border-border/70 bg-surface p-4 text-sm shadow-card sm:grid-cols-2">
          {order.delivery_slot_start && order.delivery_slot_end ? (
            <p className="flex items-start gap-2">
              <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              <span>
                <span className="block text-muted">{t("slot")}</span>
                <span className="font-semibold text-ink">
                  {`${deliveryDay(tOrdering, order.delivery_slot_start)}, ${slotWindow(tOrdering, order.delivery_slot_start, order.delivery_slot_end)}`}
                </span>
              </span>
            </p>
          ) : null}
          <p className="flex items-start gap-2">
            <Banknote aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
            <span>
              <span className="block text-muted">{t("payment")}</span>
              <span className="font-semibold text-ink">
                {tOrdering(`payment.${order.payment_method}`)} ·{" "}
                {tOrdering(`payment.${order.payment_status}`)}
              </span>
            </span>
          </p>
          {order.placed_by_name ? (
            <p className="flex items-start gap-2">
              <UserRound aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              <span className="text-ink">{t("placedBy", { name: order.placed_by_name })}</span>
            </p>
          ) : null}
          {order.invoice_number ? (
            <p className="flex items-start gap-2">
              <Receipt aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              <span>
                <span className="block font-semibold text-ink">
                  {t("invoice", { number: order.invoice_number })}
                </span>
                {order.due_date && due > 0 ? (
                  <span className="text-muted">
                    {t("dueDate", { date: ltr(formatDate(order.due_date)) })}
                  </span>
                ) : null}
              </span>
            </p>
          ) : null}
          {order.notes ? (
            <p className="flex items-start gap-2 sm:col-span-2">
              <MessageSquareText aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              <span>
                <span className="block text-muted">{t("notes")}</span>
                <span className="text-ink">{order.notes}</span>
              </span>
            </p>
          ) : null}
        </section>

        <section className="rounded-lg border border-border/70 bg-surface shadow-card">
          <h2 className="px-4 pt-4 font-heading text-lg font-bold text-ink">
            {t("items")}{" "}
            <span className="num text-sm font-normal text-muted">({items.length})</span>
          </h2>
          <ul className="divide-y divide-border/70 px-4">
            {items.map((item) => {
              const name = localName(item, locale);
              const needed = item.base_qty + item.free_base_qty;
              const short =
                active && item.available_base_qty !== null
                  ? Math.max(
                      0,
                      needed - item.reserved_base_qty - Math.max(0, item.available_base_qty),
                    )
                  : 0;
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
                        {t("free", { count: item.free_base_qty })}
                      </p>
                    ) : null}
                    {short > 0 ? (
                      <p className="num mt-0.5 flex items-center gap-1 text-xs font-bold text-danger-ink">
                        <TriangleAlert aria-hidden className="size-3.5" />
                        {t("shortStock", { count: short })}
                      </p>
                    ) : null}
                    {item.delivered_base_qty !== null && item.delivered_base_qty < item.base_qty ? (
                      <p className="num mt-0.5 text-xs font-semibold text-awning-ink">
                        {t("deliveredOf", { count: item.delivered_base_qty, total: item.base_qty })}
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
              <dt className="text-muted">{t("subtotal")}</dt>
              <dd className="text-ink">{formatRs(order.subtotal_paisa)}</dd>
            </div>
            {order.scheme_discount_paisa > 0 ? (
              <div className="flex justify-between">
                <dt className="text-muted">{t("schemeDiscount")}</dt>
                <dd className="font-semibold text-primary-strong">
                  {formatRs(-order.scheme_discount_paisa)}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-muted">{t("deliveryFee")}</dt>
              <dd className="text-ink">{formatRs(order.delivery_fee_paisa)}</dd>
            </div>
            <div className="mt-1 flex justify-between font-heading text-lg font-extrabold text-ink">
              <dt>{t("total")}</dt>
              <dd>
                {restated ? (
                  <s className="me-2 text-sm font-normal text-muted">
                    {formatRs(order.ordered_total_paisa)}
                  </s>
                ) : null}
                {formatRs(order.total_paisa)}
              </dd>
            </div>
            {order.paid_paisa > 0 ? (
              <>
                <div className="flex justify-between">
                  <dt className="text-muted">{t("paid")}</dt>
                  <dd className="text-ink">{formatRs(order.paid_paisa)}</dd>
                </div>
                <div className="flex justify-between font-semibold">
                  <dt className="text-ink">{t("due")}</dt>
                  <dd className={due > 0 ? "text-danger-ink" : "text-ink"}>{formatRs(due)}</dd>
                </div>
              </>
            ) : null}
          </dl>
        </section>

        <section className="rounded-lg border border-border/70 bg-surface p-4 shadow-card">
          <h2 className="mb-3 font-heading text-lg font-bold text-ink">{t("timeline")}</h2>
          <ol className="flex flex-col gap-3">
            {history.map((row) => (
              <li key={row.id} className="flex gap-3 text-sm">
                <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">
                    {tOrdering(`status.${row.to_status}`)}
                    {row.changed_by_name ? (
                      <span className="font-normal text-muted"> · {row.changed_by_name}</span>
                    ) : null}
                  </span>
                  {row.note ? <span className="block text-muted">{row.note}</span> : null}
                  <span className="num block text-xs text-muted">
                    {ltr(formatDateTime(row.created_at))}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <OrderActionBar />
      </div>
    </OrderWorkflow>
  );
}

/** One order as the distributor sees it: who ordered, how to reach them, and the next step. */
export function OrgOrderPage(props: Props) {
  return (
    <Suspense fallback={<OrderSkeleton />}>
      <OrderContent {...props} />
    </Suspense>
  );
}
