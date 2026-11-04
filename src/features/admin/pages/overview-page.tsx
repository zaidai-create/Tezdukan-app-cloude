import {
  BadgeCheck,
  ChevronRight,
  Clock3,
  LifeBuoy,
  type LucideIcon,
  ShoppingBag,
  Store,
  Trash2,
  Truck,
  UserPlus,
  Users,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";
import { percentChange } from "@/features/shop-report/figures";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/session";
import { TIME_ZONE, formatDate, formatNumber } from "@/lib/format";
import { formatRs } from "@/lib/money";
import {
  AdminHeader,
  AdminPageShell,
  ChangeLine,
  LinkTabs,
  ListCard,
  MetricTile,
  OrderTag,
} from "../components/admin-ui";
import { type MarketBar, MarketplaceChart } from "../components/marketplace-chart";
import { TimeAgo } from "../components/time-ago";
import { getAdminOverview } from "../data";
import { type AdminRange, adminRangeSchema, adminRanges } from "../schemas";
import { first, type SearchParams } from "./shared";

function OverviewSkeleton() {
  return (
    <AdminPageShell>
      <div aria-hidden className="flex flex-col gap-5">
        <Skeleton className="h-10 w-56 rounded-md" />
        <Skeleton className="h-12 w-full rounded-full" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </AdminPageShell>
  );
}

const day = (value: string) => new Date(`${value}T12:00:00+05:00`);

async function OverviewContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  await requireRole("admin", "/admin");
  const params = await searchParams;
  const range: AdminRange = adminRangeSchema.parse(first(params.range));
  const [t, tCustomer, tB2b, locale, data] = await Promise.all([
    getTranslations("admin"),
    getTranslations("customerOrders.status"),
    getTranslations("ordering.status"),
    getLocale(),
    getAdminOverview(range),
  ]);
  const { kpis, previous, attention, totals } = data;
  const gmv = kpis.customer_paisa + kpis.b2b_paisa;
  const gmvBefore = previous.customer_paisa + previous.b2b_paisa;
  const change = (now: number, before: number) => {
    const value = percentChange(now, before);
    return {
      change: value,
      up: t("change.up", { percent: Math.abs(value ?? 0) }),
      down: t("change.down", { percent: Math.abs(value ?? 0) }),
      same: t("change.same"),
    };
  };

  const weekday = new Intl.DateTimeFormat(locale === "ur" ? "ur-PK" : "en-PK", {
    weekday: "short",
    timeZone: TIME_ZONE,
  });
  const bars: MarketBar[] = data.series.map((entry, index) => ({
    key: entry.day,
    label: `${weekday.format(day(entry.day))} · ${formatDate(day(entry.day))}`,
    tick: index % 2 === data.series.length % 2 ? String(Number(entry.day.slice(8, 10))) : "",
    customer: entry.customer_paisa,
    b2b: entry.b2b_paisa,
    customerLabel: formatRs(entry.customer_paisa),
    b2bLabel: formatRs(entry.b2b_paisa),
    totalLabel: formatRs(entry.customer_paisa + entry.b2b_paisa),
  }));

  const alerts: { href: string | null; icon: LucideIcon; label: string; count: number }[] = [
    {
      href: "/admin/approvals",
      icon: BadgeCheck,
      label: t("attention.approvals"),
      count: attention.pending_shops + attention.pending_orgs,
    },
    {
      href: "/admin/orders?kind=customer",
      icon: Clock3,
      label: t("attention.stuckCustomer"),
      count: attention.stuck_customer_orders,
    },
    {
      href: "/admin/orders?kind=b2b",
      icon: Truck,
      label: t("attention.stuckB2b"),
      count: attention.stuck_b2b_orders,
    },
    {
      href: "/admin/support",
      icon: LifeBuoy,
      label: t("attention.support"),
      count: attention.open_support,
    },
    {
      href: null,
      icon: Trash2,
      label: t("attention.deletions"),
      count: attention.deletion_requests,
    },
  ];
  const waiting = alerts.filter((alert) => alert.count > 0);

  return (
    <AdminPageShell>
      <AdminHeader title={t("overview.title")} subtitle={t("overview.subtitle")} />
      <LinkTabs
        label={t("ranges.label")}
        items={adminRanges.map((option) => ({
          href: option === "today" ? "/admin" : `/admin?range=${option}`,
          label: t(`ranges.${option}`),
          active: option === range,
        }))}
      />

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label={t("kpi.gmv")} value={formatRs(gmv)} icon={ShoppingBag}>
          <ChangeLine {...change(gmv, gmvBefore)} />
        </MetricTile>
        <MetricTile
          label={t("kpi.customerOrders")}
          value={formatNumber(kpis.customer_orders)}
          icon={ShoppingBag}
        >
          <ChangeLine {...change(kpis.customer_orders, previous.customer_orders)} />
        </MetricTile>
        <MetricTile label={t("kpi.b2bOrders")} value={formatNumber(kpis.b2b_orders)} icon={Truck}>
          <ChangeLine {...change(kpis.b2b_orders, previous.b2b_orders)} />
        </MetricTile>
        <MetricTile label={t("kpi.newUsers")} value={formatNumber(kpis.new_users)} icon={UserPlus}>
          <ChangeLine {...change(kpis.new_users, previous.new_users)} />
        </MetricTile>
      </dl>

      <section
        aria-labelledby="attention"
        className={cn(
          "flex flex-col gap-2 rounded-lg border p-4 shadow-card",
          waiting.length > 0 ? "border-awning/40 bg-tint-amber" : "border-border/60 bg-surface",
        )}
      >
        <h2 id="attention" className="font-heading text-lg font-bold text-ink">
          {t("attention.title")}
        </h2>
        {waiting.length === 0 ? (
          <p className="text-sm text-muted">{t("attention.allClear")}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {waiting.map((alert) => {
              const body = (
                <>
                  <alert.icon
                    aria-hidden
                    className="size-5 shrink-0 text-awning-ink"
                    strokeWidth={1.75}
                  />
                  <span className="min-w-0 flex-1 text-sm font-semibold text-ink">
                    {alert.label}
                  </span>
                  <span className="num rounded-full bg-danger px-2 py-0.5 text-sm font-bold text-on-danger">
                    {alert.count}
                  </span>
                  {alert.href ? (
                    <ChevronRight aria-hidden className="size-4 text-muted rtl:-scale-x-100" />
                  ) : null}
                </>
              );
              return (
                <li key={alert.label}>
                  {alert.href ? (
                    <Link
                      href={alert.href}
                      className="flex min-h-12 items-center gap-3 rounded-md px-1"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="flex min-h-12 items-center gap-3 px-1">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
          <h2 className="font-heading text-lg font-bold text-ink">{t("chart.title")}</h2>
          <MarketplaceChart
            bars={bars}
            label={t("chart.title")}
            legend={{ customer: t("chart.customer"), b2b: t("chart.b2b") }}
            tableCaption={t("chart.title")}
            columns={{ day: t("chart.day"), customer: t("chart.customer"), b2b: t("chart.b2b") }}
          />
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-heading text-lg font-bold text-ink">{t("feed.title")}</h2>
            <Link
              href="/admin/orders"
              className="inline-flex min-h-12 items-center gap-0.5 text-sm font-semibold text-primary"
            >
              {t("feed.all")}
              <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
            </Link>
          </div>
          {data.feed.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted">
              {t("feed.empty")}
            </p>
          ) : (
            <ListCard label={t("feed.title")}>
              {data.feed.map((order) => (
                <li key={`${order.kind}-${order.id}`} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-md",
                      order.kind === "customer"
                        ? "bg-primary-soft text-primary-strong"
                        : "bg-awning-soft text-awning-ink",
                    )}
                  >
                    {order.kind === "customer" ? (
                      <ShoppingBag aria-hidden className="size-5" strokeWidth={1.75} />
                    ) : (
                      <Truck aria-hidden className="size-5" strokeWidth={1.75} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {order.buyer ? `${order.seller} → ${order.buyer}` : order.seller}
                    </span>
                    <span className="num block truncate text-xs text-muted">
                      {order.number}
                      {" · "}
                      <TimeAgo value={order.created_at} />
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="num text-sm font-bold text-ink">
                      {formatRs(order.total_paisa)}
                    </span>
                    <OrderTag
                      status={order.status}
                      label={
                        order.kind === "customer"
                          ? tCustomer(order.status as "placed")
                          : tB2b(order.status as "new")
                      }
                    />
                  </span>
                </li>
              ))}
            </ListCard>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-bold text-ink">{t("top.title")}</h2>
          {data.top_shops.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted">
              {t("top.empty")}
            </p>
          ) : (
            <ListCard label={t("top.title")}>
              {data.top_shops.map((shop, index) => (
                <li key={shop.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="num flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-strong">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {shop.name}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {[shop.area, t("top.orders", { count: shop.orders })]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="num text-sm font-bold text-ink">
                    {formatRs(shop.sales_paisa)}
                  </span>
                </li>
              ))}
            </ListCard>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-bold text-ink">{t("totals.title")}</h2>
          <dl className="grid grid-cols-2 gap-3">
            <MetricTile
              label={t("totals.liveDukans")}
              value={`${formatNumber(totals.shops_live)} / ${formatNumber(totals.shops)}`}
              icon={Store}
            />
            <MetricTile
              label={t("totals.distributors")}
              value={formatNumber(totals.orgs)}
              icon={Truck}
            />
            <MetricTile label={t("totals.users")} value={formatNumber(totals.users)} icon={Users} />
            <MetricTile
              label={t("totals.customers")}
              value={formatNumber(kpis.customers)}
              icon={ShoppingBag}
            />
          </dl>
        </section>
      </div>
    </AdminPageShell>
  );
}

/** The admin home: the marketplace today, what needs attention, sales and the newest orders. */
export function AdminOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <OverviewContent searchParams={searchParams} />
    </Suspense>
  );
}
