import {
  ArrowLeft,
  Info,
  Lock,
  type LucideIcon,
  Minus,
  ReceiptText,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { type ReactNode, Suspense } from "react";
import { cn } from "cn";
import { EmptyState } from "@/components/states/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireDukan } from "@/features/ordering/data";
import { Link } from "@/i18n/navigation";
import { TIME_ZONE, formatDate, formatNumber } from "@/lib/format";
import { formatRs } from "@/lib/money";
import { type ChartBar, SalesChart } from "./components/sales-chart";
import { getSalesReport } from "./data";
import { hourLabel, marginOf, peakIndex, percentChange, slotLabel } from "./figures";
import { type ReportRange, type SalesReport, reportRangeSchema, reportRanges } from "./schemas";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type T = Awaited<ReturnType<typeof getTranslations<"shopReport">>>;

/** A SQL date (YYYY-MM-DD) as a Date at midday in Pakistan, so formatting never slips a day. */
const day = (value: string) => new Date(`${value}T12:00:00+05:00`);

function ReportSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5" aria-hidden>
      <Skeleton className="h-12 w-40 rounded-md" />
      <Skeleton className="h-12 w-full rounded-full" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-lg" />
    </div>
  );
}

function Change({
  current,
  previous,
  t,
  onDark = false,
}: {
  current: number;
  previous: number;
  t: T;
  onDark?: boolean;
}) {
  const change = percentChange(current, previous);
  if (change === null) return null;
  const Icon: LucideIcon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
  const text =
    change > 0
      ? t("up", { percent: change })
      : change < 0
        ? t("down", { percent: Math.abs(change) })
        : t("same");
  return (
    <span
      className={cn(
        "num inline-flex items-center gap-1 text-sm font-semibold",
        onDark
          ? "text-on-forest"
          : change > 0
            ? "text-primary-strong"
            : change < 0
              ? "text-danger-ink"
              : "text-muted",
      )}
    >
      <Icon aria-hidden className="size-4" strokeWidth={1.75} />
      {text}
    </span>
  );
}

function Tile({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className="num font-heading text-2xl font-bold text-ink">{value}</dd>
      {children ? <dd className="flex flex-col gap-0.5 text-sm text-muted">{children}</dd> : null}
    </div>
  );
}

function chartBars(report: SalesReport, t: T, locale: string): ChartBar[] {
  const weekday = new Intl.DateTimeFormat(locale === "ur" ? "ur-PK" : "en-PK", {
    weekday: "short",
    timeZone: TIME_ZONE,
  });
  const last = report.series.length - 1;
  return report.series.map((entry, index) => {
    const base = {
      value: entry.sales_paisa,
      valueLabel: formatRs(entry.sales_paisa),
      ordersLabel: t("barOrders", { count: entry.orders }),
    };
    if (entry.start_hour !== null) {
      return {
        ...base,
        key: `h${entry.start_hour}`,
        label: slotLabel(entry.start_hour),
        tick: hourLabel(entry.start_hour),
      };
    }
    const date = day(entry.day ?? report.to);
    const name = weekday.format(date);
    // Thirty bars cannot all carry a date: label today and every fifth day back from it.
    const tick =
      report.range === "month"
        ? (last - index) % 5 === 0
          ? String(Number((entry.day ?? "").slice(8, 10)))
          : ""
        : name;
    return {
      ...base,
      key: entry.day ?? String(index),
      label: `${name} · ${formatDate(date)}`,
      tick,
    };
  });
}

async function ReportContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const { shopId } = await requireDukan("/dukan/reports");
  const params = await searchParams;
  const range: ReportRange = reportRangeSchema.parse(
    Array.isArray(params.range) ? params.range[0] : params.range,
  );
  const [t, locale, report] = await Promise.all([
    getTranslations("shopReport"),
    getLocale(),
    getSalesReport(shopId, range),
  ]);

  const header = (
    <header className="flex items-center gap-3">
      <Link
        href="/dukan"
        aria-label={t("back")}
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-card"
      >
        <ArrowLeft aria-hidden className="size-5 rtl:-scale-x-100" />
      </Link>
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-bold text-ink">{t("title")}</h1>
        <p className="truncate text-sm text-muted">{t("subtitle")}</p>
      </div>
    </header>
  );

  if (!report) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5">
        {header}
        <EmptyState icon={Lock} title={t("noAccessTitle")} description={t("noAccessHint")} />
      </div>
    );
  }

  const { totals, previous } = report;
  const period =
    report.from === report.to
      ? formatDate(day(report.from))
      : `${formatDate(day(report.from))} – ${formatDate(day(report.to))}`;
  const bars = chartBars(report, t, locale);
  const salesPeak = peakIndex(bars.map((bar) => bar.value));
  const ordersPeak = peakIndex(report.series.map((entry) => entry.orders));
  const initialIndex = salesPeak >= 0 ? salesPeak : ordersPeak >= 0 ? ordersPeak : bars.length - 1;
  const margin = marginOf(totals.profit_paisa, totals.costed_paisa);
  const topMax = Math.max(...report.top_products.map((product) => product.sales_paisa), 1);
  const empty = totals.orders === 0 && totals.cancelled === 0;
  const oneDay = range === "today" || range === "yesterday";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5">
      {header}

      <nav
        aria-label={t("rangesLabel")}
        className="grid grid-cols-4 gap-1 rounded-full border border-border/60 bg-surface p-1 shadow-card"
      >
        {reportRanges.map((option) => (
          <Link
            key={option}
            href={option === "today" ? "/dukan/reports" : `/dukan/reports?range=${option}`}
            aria-current={option === range ? "page" : undefined}
            className={cn(
              "flex min-h-12 items-center justify-center rounded-full px-2 text-center text-sm font-semibold transition-colors duration-150 ease-out",
              option === range
                ? "sheen bg-action text-on-action shadow-glow inset-shadow-edge"
                : "text-ink",
            )}
          >
            {t(`ranges.${option}`)}
          </Link>
        ))}
      </nav>

      {empty ? (
        <EmptyState
          icon={ReceiptText}
          title={t("emptyTitle")}
          description={t("emptyHint")}
          action={
            <Link
              href="/dukan/customer-orders"
              className="sheen flex min-h-12 items-center justify-center rounded-md bg-action px-4 font-semibold text-on-action shadow-glow inset-shadow-edge"
            >
              {t("emptyAction")}
            </Link>
          }
        />
      ) : (
        <>
          <section className="sheen relative overflow-hidden rounded-xl bg-forest p-5 text-on-forest shadow-raised inset-shadow-edge">
            <p className="num text-sm font-semibold text-on-forest/75">
              {t("sales")} · {period}
            </p>
            <p className="num font-heading text-4xl leading-tight font-extrabold">
              {formatRs(totals.sales_paisa)}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <Change current={totals.sales_paisa} previous={previous.sales_paisa} t={t} onDark />
              {percentChange(totals.sales_paisa, previous.sales_paisa) === null ? null : (
                <span className="text-sm text-on-forest/75">{t(`vs.${range}`)}</span>
              )}
            </p>
            {totals.in_progress > 0 ? (
              <p className="num mt-3 inline-flex rounded-full bg-on-forest/15 px-3 py-1 text-sm font-semibold">
                {t("inProgress", {
                  count: totals.in_progress,
                  amount: formatRs(totals.in_progress_paisa),
                })}
              </p>
            ) : null}
          </section>

          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label={t("orders")} value={formatNumber(totals.orders)}>
              <Change current={totals.orders} previous={previous.orders} t={t} />
              {totals.cancelled > 0 ? (
                <span className="num">{t("cancelled", { count: totals.cancelled })}</span>
              ) : null}
            </Tile>
            <Tile
              label={t("avgBill")}
              value={totals.delivered > 0 ? formatRs(totals.avg_bill_paisa) : "–"}
            >
              {totals.delivered > 0 ? (
                <Change current={totals.avg_bill_paisa} previous={previous.avg_bill_paisa} t={t} />
              ) : null}
            </Tile>
            <Tile label={t("profit")} value={margin === null ? "–" : formatRs(totals.profit_paisa)}>
              {margin === null ? (
                <span>{t("noCost")}</span>
              ) : (
                <span className="num">{t("margin", { percent: margin })}</span>
              )}
            </Tile>
            <Tile label={t("customers")} value={formatNumber(totals.customers)}>
              <Change current={totals.customers} previous={previous.customers} t={t} />
            </Tile>
          </dl>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
              <h2 className="font-heading text-lg font-bold text-ink">
                {oneDay ? t("chartDay") : t("chartDays")}
              </h2>
              <SalesChart
                bars={bars}
                initialIndex={initialIndex}
                peakIndex={salesPeak}
                label={oneDay ? t("chartDay") : t("chartDays")}
                tableCaption={t("tableCaption")}
                columnLabel={oneDay ? t("time") : t("day")}
                valueColumn={t("sales")}
              />
              {salesPeak >= 0 && oneDay ? (
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <span aria-hidden className="size-2 rounded-full bg-awning" />
                  {t("busiest", { time: bars[salesPeak]?.label ?? "" })}
                </p>
              ) : null}
            </section>

            <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
              <h2 className="font-heading text-lg font-bold text-ink">{t("topTitle")}</h2>
              {report.top_products.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">{t("topEmpty")}</p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {report.top_products.map((product, index) => {
                    const name =
                      locale === "ur" && product.name_ur ? product.name_ur : product.name;
                    return (
                      <li
                        key={`${product.name}-${product.unit}`}
                        className="flex items-center gap-3"
                      >
                        <span className="num flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-strong">
                          {index + 1}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <bdi className="truncate text-base font-semibold text-ink">{name}</bdi>
                            <span className="num shrink-0 text-base font-bold text-ink">
                              {formatRs(product.sales_paisa)}
                            </span>
                          </span>
                          <span
                            aria-hidden
                            className="h-1 rounded-full bg-chart-1/35"
                            style={{
                              width: `${Math.max((product.sales_paisa / topMax) * 100, 4)}%`,
                            }}
                          />
                          <span className="num text-sm text-muted">
                            {product.unit === "pc"
                              ? t("soldPieces", { count: product.qty })
                              : t("soldWeight", {
                                  qty: formatNumber(product.qty),
                                  unit: product.unit,
                                })}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </div>

          {totals.goods_paisa > 0 && totals.costed_paisa < totals.goods_paisa ? (
            <aside className="flex items-start gap-3 rounded-lg bg-subtle p-4">
              <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink">{t("coverage")}</p>
                <Link
                  href="/dukan/products"
                  className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-md bg-primary-soft px-4 text-sm font-semibold text-primary-strong"
                >
                  {t("coverageAction")}
                </Link>
              </div>
            </aside>
          ) : null}
        </>
      )}
    </div>
  );
}

/** The dukandar's hisab: sales, orders, profit, busy times and best sellers for a period. */
export function ShopReportPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <ReportContent searchParams={searchParams} />
    </Suspense>
  );
}
