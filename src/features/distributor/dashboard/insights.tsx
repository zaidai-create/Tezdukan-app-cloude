import { cn } from "cn";
import {
  ChevronRight,
  Gauge,
  MessageCircle,
  Phone,
  Store,
  TrendingDown,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { ProductImage } from "@/components/commerce/product-image";
import { Skeleton } from "@/components/ui/skeleton";
import { localName } from "@/features/ordering/labels";
import { storageUrl } from "@/features/ordering/images";
import { Link } from "@/i18n/navigation";
import { formatRs } from "@/lib/money";
import { whatsappNumber } from "@/lib/phone";
import { getInsights } from "../data";
import type { Insights } from "../schemas";

const stages = ["new", "confirmed", "picking", "packed", "dispatched"] as const;

export function InsightsSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-64 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/** Month to date against the same days of last month, as a whole percent. */
function monthChange(mtd: Insights["mtd"]): number | null {
  if (mtd.prev_sales_paisa === 0) return null;
  return Math.round(((mtd.sales_paisa - mtd.prev_sales_paisa) / mtd.prev_sales_paisa) * 100);
}

/** The month figures that sit inside the green hero, beside today's total. */
export async function MonthFigures({ orgId }: { orgId: string }) {
  const [insights, t] = await Promise.all([
    getInsights(orgId),
    getTranslations("distributor.dashboard"),
  ]);
  const { mtd } = insights;
  const change = monthChange(mtd);
  const aov = mtd.orders > 0 ? Math.round(mtd.sales_paisa / mtd.orders) : 0;
  return (
    <dl className="grid grid-cols-2 gap-3 sm:min-w-80">
      <div className="rounded-lg bg-on-forest/10 p-3">
        <dt className="text-sm text-on-forest/80">{t("mtdSales")}</dt>
        <dd className="num font-heading text-xl font-bold">{formatRs(mtd.sales_paisa)}</dd>
        <dd className="num mt-0.5 flex items-center gap-1 text-xs text-on-forest/85">
          {change === null ? (
            t("noCompare")
          ) : (
            <>
              {change >= 0 ? (
                <TrendingUp aria-hidden className="size-3.5 text-mint" />
              ) : (
                <TrendingDown aria-hidden className="size-3.5" />
              )}
              {change >= 0
                ? t("upVsLast", { pct: String(change) })
                : t("downVsLast", { pct: String(-change) })}
            </>
          )}
        </dd>
      </div>
      <div className="rounded-lg bg-on-forest/10 p-3">
        <dt className="text-sm text-on-forest/80">{t("aov")}</dt>
        <dd className="num font-heading text-xl font-bold">{formatRs(aov)}</dd>
        <dd className="num mt-0.5 text-xs text-on-forest/85">
          {t("ordersCount", { count: mtd.orders })}
        </dd>
      </div>
    </dl>
  );
}

export function MonthFiguresSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:min-w-80" aria-hidden>
      <Skeleton className="h-20 rounded-lg bg-on-forest/15" />
      <Skeleton className="h-20 rounded-lg bg-on-forest/15" />
    </div>
  );
}

function SectionCard({
  title,
  hint,
  action,
  className,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border/70 bg-surface p-4 shadow-card",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-bold text-ink">{title}</h2>
          {hint ? <p className="text-sm text-muted">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Pipeline, retailer health, best sellers, category split, stock running out, quiet dukans. */
export async function DashboardInsights({ orgId }: { orgId: string }) {
  const [insights, t, tStatus, format, locale] = await Promise.all([
    getInsights(orgId),
    getTranslations("distributor.dashboard"),
    getTranslations("ordering.status"),
    getFormatter(),
    getLocale(),
  ]);
  const { pipeline, retailers } = insights;
  const categoryTotal = insights.categories.reduce((sum, c) => sum + c.value_paisa, 0) || 1;
  const fill = insights.fill_rate;

  return (
    <div className="flex flex-col gap-5">
      {/* The order pipeline, left to right like the packing floor. */}
      <section aria-label={t("pipeline")} className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-bold text-ink">{t("pipeline")}</h2>
        <ol className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
          {stages.map((stage, index) => {
            const count = pipeline[stage];
            return (
              <li key={stage} className="min-w-36 shrink-0 snap-start lg:min-w-0">
                <Link
                  href={stage === "new" ? "/distributor/orders" : "/distributor/orders?tab=active"}
                  className={cn(
                    "relative flex h-full flex-col gap-1 rounded-lg border p-3 shadow-card transition-transform duration-150 ease-out active:scale-[0.98]",
                    stage === "new" && count > 0
                      ? "border-awning/60 bg-awning-soft"
                      : "border-border/70 bg-surface",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm text-muted">
                    <span className="num flex size-5 items-center justify-center rounded-full bg-subtle text-xs font-bold text-ink">
                      {index + 1}
                    </span>
                    {tStatus(stage)}
                  </span>
                  <span className="num font-heading text-3xl font-extrabold text-ink">{count}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Retailer health and how much of each order actually reaches the dukan. */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-border/70 bg-surface p-4 shadow-card">
          <span className="flex items-center gap-2 text-sm text-muted">
            <Store aria-hidden className="size-4 text-primary-strong" />
            {t("activeWeek")}
          </span>
          <span className="num mt-1 block font-heading text-2xl font-bold text-ink">
            {retailers.active}
            <span className="text-base font-semibold text-muted"> / {retailers.total}</span>
          </span>
        </div>
        <div className="rounded-lg border border-border/70 bg-surface p-4 shadow-card">
          <span className="flex items-center gap-2 text-sm text-muted">
            <UserPlus aria-hidden className="size-4 text-primary-strong" />
            {t("newRetailers")}
          </span>
          <span className="num mt-1 block font-heading text-2xl font-bold text-ink">
            {retailers.new}
          </span>
        </div>
        <div className="rounded-lg border border-border/70 bg-surface p-4 shadow-card">
          <span className="flex items-center gap-2 text-sm text-muted">
            <Store aria-hidden className="size-4 text-awning-ink" />
            {t("quietCount")}
          </span>
          <span
            className={cn(
              "num mt-1 block font-heading text-2xl font-bold",
              retailers.inactive > 0 ? "text-awning-ink" : "text-ink",
            )}
          >
            {retailers.inactive}
          </span>
        </div>
        <div className="rounded-lg border border-border/70 bg-surface p-4 shadow-card">
          <span className="flex items-center gap-2 text-sm text-muted">
            <Gauge aria-hidden className="size-4 text-primary-strong" />
            {t("fillRate")}
          </span>
          <span
            className={cn(
              "num mt-1 block font-heading text-2xl font-bold",
              fill === null
                ? "text-muted"
                : fill >= 95
                  ? "text-primary-strong"
                  : fill >= 85
                    ? "text-awning-ink"
                    : "text-danger-ink",
            )}
          >
            {fill === null ? "–" : `${fill}%`}
          </span>
          <span className="block text-xs text-muted">{t("fillRateHint")}</span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <SectionCard title={t("topProducts")} hint={t("last30")}>
          {insights.top_products.length === 0 ? (
            <p className="text-sm text-muted">{t("noTopShops")}</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {insights.top_products.map((product) => (
                <li key={product.id} className="flex items-center gap-3">
                  <ProductImage
                    src={storageUrl(product.image_path)}
                    alt={product.name}
                    sizes="48px"
                    className="size-12 shrink-0 rounded-md"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 text-sm font-semibold text-ink">
                      {product.name}
                    </span>
                    <span className="num block text-xs text-muted">
                      {t("units", { count: product.units })}
                    </span>
                  </span>
                  <span className="num text-sm font-semibold whitespace-nowrap text-ink">
                    {formatRs(product.value_paisa)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>

        <SectionCard title={t("byCategory")} hint={t("last30")}>
          {insights.categories.length === 0 ? (
            <p className="text-sm text-muted">{t("noTopShops")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {insights.categories.map((category) => {
                const share = Math.round((category.value_paisa / categoryTotal) * 100);
                return (
                  <li key={category.id} className="flex flex-col gap-1">
                    <span className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-semibold text-ink">
                        {localName(category, locale)}
                      </span>
                      <span className="num whitespace-nowrap text-muted">
                        {formatRs(category.value_paisa)} · {share}%
                      </span>
                    </span>
                    <span className="h-2 overflow-hidden rounded-full bg-subtle">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(share, 2)}%` }}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title={t("runningLow")}
          hint={t("runningLowHint")}
          action={
            <Link
              href="/distributor/catalog"
              className="inline-flex min-h-12 shrink-0 items-center gap-0.5 text-sm font-semibold text-primary-strong"
            >
              {t("catalog")}
              <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
            </Link>
          }
        >
          {insights.running_low.length === 0 ? (
            <p className="rounded-md bg-primary-soft px-3 py-4 text-sm font-semibold text-primary-strong">
              {t("stockFine")}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border/70">
              {insights.running_low.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 text-sm font-semibold text-ink">{item.name}</span>
                    <span className="num block text-xs text-muted">
                      {t("piecesLeft", { count: item.available_base_qty })}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "num shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                      item.days_left <= 3
                        ? "bg-danger-soft text-danger-ink"
                        : "bg-awning-soft text-awning-ink",
                    )}
                  >
                    {item.days_left === 0
                      ? t("outOfStock")
                      : t("daysLeft", { count: item.days_left })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {insights.inactive_shops.length > 0 ? (
        <SectionCard title={t("quietShops")} hint={t("quietHint")}>
          <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {insights.inactive_shops.map((shop) => {
              return (
                <li
                  key={shop.id}
                  className="flex items-center gap-3 rounded-md bg-subtle px-3 py-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{shop.name}</span>
                    <span className="num block text-xs text-muted">
                      {t("lastOrder", {
                        date: format.dateTime(new Date(shop.last_order_at), {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          timeZone: "Asia/Karachi",
                        }),
                        days: shop.days_quiet,
                      })}
                    </span>
                  </span>
                  {shop.phone ? (
                    <span className="flex shrink-0 gap-1.5">
                      <a
                        href={`tel:${shop.phone}`}
                        aria-label={t("callShop", { name: shop.name })}
                        className="flex size-12 items-center justify-center rounded-full bg-surface text-primary-strong shadow-card"
                      >
                        <Phone aria-hidden className="size-5" />
                      </a>
                      <a
                        href={`https://wa.me/${whatsappNumber(shop.phone)}?text=${encodeURIComponent(t("nudgeText", { name: shop.name }))}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={t("whatsappShop", { name: shop.name })}
                        className="flex size-12 items-center justify-center rounded-full bg-surface text-primary-strong shadow-card"
                      >
                        <MessageCircle aria-hidden className="size-5" />
                      </a>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </SectionCard>
      ) : null}
    </div>
  );
}
