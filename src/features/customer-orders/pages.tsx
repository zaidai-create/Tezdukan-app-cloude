import { ArrowLeft, ChevronRight, MessageSquareShare, Phone, ReceiptText } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { cn } from "cn";
import { EmptyState } from "@/components/states/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { NotificationPrompt } from "@/features/notifications/components/notification-prompt";
import { getNearbyShops } from "@/features/storefront/data";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/session";
import { telHref, whatsappHref } from "@/lib/contact";
import { formatDateTime } from "@/lib/format";
import { formatRs } from "@/lib/money";
import { formatPkMobile } from "@/lib/phone";
import { ShopOrderActions } from "./components/order-actions";
import { OrderMenu } from "./components/order-menu";
import { OrderAgainButton } from "./components/order-again-button";
import { OrderCelebration } from "./components/order-celebration";
import { RateItems } from "./components/rate-items";
import { ReportProblem } from "./components/report-problem";
import { OrderChanges } from "./components/order-changes";
import { UnavailableItems } from "./components/unavailable-items";
import { RateOrder } from "./components/rate-order";
import { OrderHero, OrderProgress, OrderStatusBadge, OrderSummary } from "./components/order-parts";
import {
  getCustomerHistoryAtShop,
  getCustomerOrder,
  getMyCustomerOrders,
  getMyItemRatings,
  getOrderChanges,
  hasOpenProblem,
  getMyOrderRating,
  getShopCustomerOrders,
} from "./data";
import type { CustomerOrder, InboxTab } from "./schemas";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function ListSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-5" aria-hidden>
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-24 w-full rounded-lg" />
      ))}
    </div>
  );
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-card"
    >
      <ArrowLeft aria-hidden className="size-5 rtl:-scale-x-100" />
    </Link>
  );
}

function OrderRow({ order, href, title }: { order: CustomerOrder; href: string; title: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-border/60 bg-surface p-4 shadow-card transition-transform duration-150 ease-out active:scale-[0.98]"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-heading text-base font-semibold text-ink">{title}</span>
          <OrderStatusBadge status={order.status} />
        </span>
        <span className="num block text-sm text-muted">
          {order.order_number} · {formatDateTime(order.created_at)}
        </span>
        <span className="num block font-semibold text-ink">{formatRs(order.total_paisa)}</span>
      </span>
      <ChevronRight aria-hidden className="size-5 text-muted rtl:-scale-x-100" />
    </Link>
  );
}

// ------------------------------------------------------------------------------------------------
// Customer
// ------------------------------------------------------------------------------------------------

async function MyOrdersContent() {
  await connection();
  const session = await requireRole("customer", "/orders");
  const [t, orders] = await Promise.all([
    getTranslations("customerOrders"),
    getMyCustomerOrders(session.userId),
  ]);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
      <header className="flex items-center gap-3">
        <BackLink href="/account" label={t("back")} />
        <h1 className="font-heading text-2xl font-bold text-ink">{t("title")}</h1>
      </header>
      <NotificationPrompt audience="customer" />
      {orders.length === 0 ? (
        <EmptyState icon={ReceiptText} title={t("empty")} description={t("emptyHint")} />
      ) : (
        orders.map((order) => (
          <OrderRow
            key={order.id}
            order={order}
            href={`/orders/${order.id}`}
            title={order.shop_name}
          />
        ))
      )}
    </div>
  );
}

export function MyOrdersPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <MyOrdersContent />
    </Suspense>
  );
}

async function MyOrderContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  await connection();
  const { id } = await params;
  await requireRole("customer", `/orders/${id}`);
  const [t, order, query] = await Promise.all([
    getTranslations("customerOrders"),
    getCustomerOrder(id),
    searchParams,
  ]);
  if (!order) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <EmptyState icon={ReceiptText} title={t("errors.order_not_found")} />
      </div>
    );
  }
  const justPlaced = query.placed === "1" && order.status === "placed";
  const delivered = order.status === "delivered";
  const [shops, myRating, itemRatings, changes, reported] = await Promise.all([
    getNearbyShops().catch(() => []),
    delivered ? getMyOrderRating(order.id) : Promise.resolve(null),
    delivered ? getMyItemRatings(order.id) : Promise.resolve({}),
    getOrderChanges(order.id),
    hasOpenProblem(order.id),
  ]);
  const shop = shops.find((s) => s.id === order.shop_id);
  const call = telHref(shop?.phone);
  const whatsapp = whatsappHref(
    shop?.whatsapp ?? shop?.phone,
    t("whatsappAbout", { number: order.order_number }),
  );
  const finished = ["delivered", "cancelled", "rejected"].includes(order.status);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
      {justPlaced ? (
        <OrderCelebration shop={order.shop_name} orderNumber={order.order_number} />
      ) : null}
      <header className="flex items-center gap-3">
        <BackLink href="/orders" label={t("back")} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-heading text-2xl font-bold text-ink">{order.shop_name}</h1>
          <p className="flex items-center gap-2 text-sm text-muted">
            <span className="num" data-order-number>
              {order.order_number}
            </span>
            <OrderStatusBadge status={order.status} />
          </p>
        </div>
        <OrderMenu order={order} callHref={call} reported={reported} />
      </header>
      <OrderHero order={order} etaMinutes={shop?.eta_minutes ?? null} />
      {call || whatsapp ? (
        <div className="grid grid-cols-2 gap-3">
          {call ? (
            <a
              href={call}
              className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-border/60 bg-surface font-semibold text-ink shadow-card"
            >
              <Phone aria-hidden className="size-5 text-primary-strong" />
              {t("callShop")}
            </a>
          ) : null}
          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-border/60 bg-surface font-semibold text-ink shadow-card"
            >
              <MessageSquareShare aria-hidden className="size-5 text-primary-strong" />
              {t("whatsappShop")}
            </a>
          ) : null}
        </div>
      ) : null}
      <NotificationPrompt audience="customer" />
      {delivered ? (
        <>
          <RateOrder orderId={order.id} shop={order.shop_name} current={myRating} />
          <RateItems
            orderId={order.id}
            items={order.customer_order_items ?? []}
            current={itemRatings}
          />
        </>
      ) : null}
      <section className="rounded-lg border border-border/60 bg-surface p-4 shadow-card">
        <OrderProgress order={order} />
      </section>
      <OrderChanges changes={changes} />
      <OrderSummary order={order} />
      {finished ? <OrderAgainButton orderId={order.id} /> : null}
      {/* Once it has arrived, "something's wrong" is the likely next step, so it is in view;
          before that it lives in the ⋮ menu with Cancel. A sent report always shows. */}
      {reported || order.status === "delivered" ? (
        <ReportProblem orderId={order.id} reported={reported} />
      ) : null}
    </div>
  );
}

export function MyOrderPage(props: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <MyOrderContent {...props} />
    </Suspense>
  );
}

// ------------------------------------------------------------------------------------------------
// Dukan
// ------------------------------------------------------------------------------------------------

const tabs: InboxTab[] = ["new", "active", "done"];

async function ShopOrdersContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const session = await requireRole("dukandar", "/dukan/customer-orders");
  const shopId = session.activeContextId;
  const params = await searchParams;
  const tab = tabs.find((value) => value === params.tab) ?? "new";
  const [t, orders] = await Promise.all([
    getTranslations("customerOrders"),
    shopId ? getShopCustomerOrders(shopId, tab) : Promise.resolve([]),
  ]);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
      <header className="flex items-center gap-3">
        <BackLink href="/dukan" label={t("back")} />
        <h1 className="font-heading text-2xl font-bold text-ink">{t("shopTitle")}</h1>
      </header>
      <NotificationPrompt audience="dukandar" />
      <nav
        aria-label={t("shopTitle")}
        className="grid grid-cols-3 gap-1 rounded-full bg-subtle p-1"
      >
        {tabs.map((value) => (
          <Link
            key={value}
            href={
              value === "new" ? "/dukan/customer-orders" : `/dukan/customer-orders?tab=${value}`
            }
            aria-current={tab === value ? "page" : undefined}
            className={cn(
              "flex h-11 items-center justify-center rounded-full text-sm font-semibold transition-colors",
              tab === value ? "bg-surface text-ink shadow-card" : "text-muted",
            )}
          >
            {t(`tabs.${value}`)}
          </Link>
        ))}
      </nav>
      {orders.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={t(`shopEmpty.${tab}`)}
          description={t("shopEmptyHint")}
        />
      ) : (
        orders.map((order) => (
          <OrderRow
            key={order.id}
            order={order}
            href={`/dukan/customer-orders/${order.id}`}
            title={order.customer_name ?? t("customer")}
          />
        ))
      )}
    </div>
  );
}

export function ShopOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <ShopOrdersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ShopOrderContent({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  await requireRole("dukandar", `/dukan/customer-orders/${id}`);
  const [t, order, changes] = await Promise.all([
    getTranslations("customerOrders"),
    getCustomerOrder(id),
    getOrderChanges(id),
  ]);
  const history = order ? await getCustomerHistoryAtShop(order) : null;
  if (!order) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <EmptyState icon={ReceiptText} title={t("errors.order_not_found")} />
      </div>
    );
  }
  const tel = telHref(order.customer_phone);
  const wa = whatsappHref(order.customer_phone);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
      <header className="flex items-center gap-3">
        <BackLink href="/dukan/customer-orders" label={t("back")} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-heading text-2xl font-bold text-ink">
            {order.order_number}
          </h1>
          <p className="num text-sm text-muted">{formatDateTime(order.created_at)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </header>
      <section className="flex items-center gap-3 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-lg font-semibold text-ink">
            {order.customer_name ?? t("customer")}
          </span>
          {order.customer_phone ? (
            <bdi dir="ltr" className="num block text-sm text-muted">
              {formatPkMobile(order.customer_phone)}
            </bdi>
          ) : null}
          {history ? (
            <span className="num mt-1 flex flex-wrap gap-1.5">
              {history.delivered + history.cancelled === 0 ? (
                <StatusBadge tone="neutral">{t("history.first")}</StatusBadge>
              ) : (
                <>
                  <StatusBadge tone="success">
                    {t("history.delivered", { count: history.delivered })}
                  </StatusBadge>
                  {history.cancelled > 0 ? (
                    <StatusBadge tone="warning">
                      {t("history.cancelled", { count: history.cancelled })}
                    </StatusBadge>
                  ) : null}
                </>
              )}
            </span>
          ) : null}
        </span>
        {tel ? (
          <a
            href={tel}
            aria-label={t("call")}
            className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-strong"
          >
            <Phone aria-hidden className="size-5" />
          </a>
        ) : null}
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("whatsapp")}
            className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-strong"
          >
            <MessageSquareShare aria-hidden className="size-5" />
          </a>
        ) : null}
      </section>
      <section className="rounded-lg border border-border/60 bg-surface p-4 shadow-card">
        <OrderProgress order={order} />
      </section>
      <OrderChanges changes={changes} />
      <OrderSummary order={order} forShop />
      <UnavailableItems order={order} />
      <ShopOrderActions orderId={order.id} status={order.status} />
    </div>
  );
}

export function ShopOrderPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <ShopOrderContent params={params} />
    </Suspense>
  );
}
