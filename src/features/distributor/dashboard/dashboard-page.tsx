import { cn } from "cn";
import {
  ArrowRight,
  CircleAlert,
  Clock3,
  type LucideIcon,
  Package,
  PackageCheck,
  PhoneCall,
  Store,
  Truck,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { activeContextOf } from "@/lib/auth/session-types";
import { formatRs } from "@/lib/money";
import { OrderCard } from "../components/order-card";
import { getDashboard, getInbox, requireDistributor } from "../data";
import { SalesChart } from "./sales-chart";

function DashboardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 lg:px-8" aria-hidden>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-56 w-full rounded-lg" />
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = "neutral",
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "warning" | "danger";
  href?: string;
}) {
  const body = (
    <>
      <span className="flex items-center gap-2 text-sm text-muted">
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-full",
            tone === "danger"
              ? "bg-danger-soft text-danger-ink"
              : tone === "warning"
                ? "bg-awning-soft text-awning-ink"
                : "bg-primary-soft text-primary-strong",
          )}
        >
          <Icon aria-hidden className="size-4" />
        </span>
        {label}
      </span>
      <span className="num mt-2 block font-heading text-2xl font-bold text-ink">{value}</span>
      {hint ? <span className="num block text-xs text-muted">{hint}</span> : null}
    </>
  );
  const className =
    "block rounded-lg border border-border/70 bg-surface p-4 shadow-card transition-transform";
  return href ? (
    <Link href={href} className={cn(className, "active:scale-[0.99]")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

async function DashboardContent() {
  await connection();
  const { session, orgId } = await requireDistributor("/distributor");
  const [dash, inbox, t] = await Promise.all([
    getDashboard(orgId),
    getInbox(orgId, "new"),
    getTranslations("distributor.dashboard"),
  ]);
  const org = activeContextOf(session)?.name ?? "";
  const firstName = session.fullName.split(" ")[0] || session.fullName;
  const weekTotal = dash.sales_7d.reduce((sum, d) => sum + d.value_paisa, 0);
  const weekOrders = dash.sales_7d.reduce((sum, d) => sum + d.orders, 0);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 lg:px-8">
      <header>
        <h1 className="font-heading text-2xl font-extrabold text-ink lg:text-3xl">
          {t("greeting", { name: firstName })}
        </h1>
        <p className="mt-1 text-base text-muted">{t("subtitle", { org })}</p>
      </header>

      {dash.needs_confirmation > 0 ? (
        <Link
          href="/distributor/orders"
          className="flex items-center gap-4 rounded-xl border border-awning/60 bg-awning-soft p-4 shadow-card"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-awning text-on-awning">
            <PhoneCall aria-hidden className="size-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-heading text-lg font-bold text-awning-ink">
              {t("needsCall", { count: dash.needs_confirmation })}
            </span>
            <span className="block text-sm text-ink">{t("needsCallHint")}</span>
          </span>
          <span className="flex items-center gap-1 text-sm font-semibold text-awning-ink">
            {t("review")}
            <ArrowRight aria-hidden className="size-4 rtl:-scale-x-100" />
          </span>
        </Link>
      ) : null}

      {/* The one hero figure: what came in today. */}
      <section className="sheen relative overflow-hidden rounded-xl bg-forest p-5 text-on-forest shadow-raised inset-shadow-edge">
        <p className="text-sm font-semibold text-on-forest/85">{t("todayOrders")}</p>
        <p className="num mt-1 font-heading text-5xl font-extrabold">
          {formatRs(dash.today_value_paisa)}
        </p>
        <p className="num mt-1 text-sm text-on-forest/85">
          {t("ordersCount", { count: dash.today_orders })}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Clock3}
          label={t("newOrders")}
          value={String(dash.new_orders)}
          tone={dash.new_orders > 0 ? "warning" : "neutral"}
          href="/distributor/orders"
        />
        <StatTile
          icon={Package}
          label={t("toDispatch")}
          value={String(dash.to_dispatch)}
          href="/distributor/orders?tab=active"
        />
        <StatTile
          icon={Truck}
          label={t("outForDelivery")}
          value={String(dash.out_for_delivery)}
          href="/distributor/orders?tab=active"
        />
        <StatTile
          icon={PackageCheck}
          label={t("deliveredToday")}
          value={formatRs(dash.delivered_today_paisa)}
        />
        <StatTile icon={Wallet} label={t("receivable")} value={formatRs(dash.receivable_paisa)} />
        <StatTile
          icon={CircleAlert}
          label={t("overdue")}
          value={formatRs(dash.overdue_paisa)}
          tone={dash.overdue_paisa > 0 ? "danger" : "neutral"}
        />
        <StatTile
          icon={Store}
          label={t("activeShops")}
          value={String(dash.active_shops)}
          hint={t("activeShopsHint")}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-5">
        <section className="rounded-lg border border-border/70 bg-surface p-4 shadow-card lg:col-span-3">
          <h2 className="font-heading text-lg font-bold text-ink">{t("sales7d")}</h2>
          <p className="num mb-4 text-sm text-muted">
            {t("sales7dTotal", { total: formatRs(weekTotal), count: weekOrders })}
          </p>
          <SalesChart days={dash.sales_7d} title={t("sales7d")} />
        </section>

        <section className="rounded-lg border border-border/70 bg-surface p-4 shadow-card lg:col-span-2">
          <h2 className="mb-3 font-heading text-lg font-bold text-ink">{t("topShops")}</h2>
          {dash.top_shops.length === 0 ? (
            <p className="text-sm text-muted">{t("noTopShops")}</p>
          ) : (
            <ol className="flex flex-col divide-y divide-border/70">
              {dash.top_shops.map((shop, index) => (
                <li key={shop.id} className="flex items-center gap-3 py-2.5">
                  <span className="num flex size-8 shrink-0 items-center justify-center rounded-full bg-subtle text-sm font-bold text-ink">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{shop.name}</span>
                    <span className="num block text-xs text-muted">
                      {t("ordersCount", { count: shop.orders })}
                    </span>
                  </span>
                  <span className="num font-semibold whitespace-nowrap text-ink">
                    {formatRs(shop.value_paisa)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-ink">{t("latest")}</h2>
          <Link href="/distributor/orders" className="text-sm font-semibold text-primary-strong">
            {t("seeAll")}
          </Link>
        </div>
        {inbox.orders.length === 0 ? (
          <EmptyState icon={Package} title={t("noNew")} description={t("noNewHint")} />
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {inbox.orders.slice(0, 6).map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </ul>
        )}
        {inbox.orders.length > 6 ? (
          <Link
            href="/distributor/orders"
            className={buttonVariants({ variant: "soft", block: true })}
          >
            {t("seeAll")}
          </Link>
        ) : null}
      </section>
    </div>
  );
}

/** Distributor home: what needs a call, today's numbers, the week, and the newest orders. */
export function DistributorDashboard() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
