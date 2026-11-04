import {
  BookOpen,
  Boxes,
  ChartColumn,
  ChevronRight,
  type LucideIcon,
  PackageOpen,
  ShoppingBag,
  TriangleAlert,
  Truck,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationPrompt } from "@/features/notifications/components/notification-prompt";
import { GoOnlineCard } from "@/features/online-dukan/components/go-online-card";
import { DukanPosters } from "@/features/posters/posters";
import { getShopDistributors, requireDukan } from "@/features/ordering/data";
import { Link } from "@/i18n/navigation";
import { formatRs } from "@/lib/money";
import { QueueCard } from "./components/queue-card";
import { getShopDashboard } from "./data";

function DashboardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5" aria-hidden>
      <Skeleton className="h-56 w-full rounded-xl" />
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-44 w-full rounded-lg" />
      <Skeleton className="h-44 w-full rounded-lg" />
    </div>
  );
}

type Tile = { href: string; label: string; icon: LucideIcon; tone: string; badge?: number };

async function DashboardContent() {
  await connection();
  const { session, shopId } = await requireDukan("/dukan");
  const [t, tHome, dash, distributors] = await Promise.all([
    getTranslations("shopDash"),
    getTranslations("home"),
    getShopDashboard(shopId),
    // Staff without khata access (a cashier, a stock helper) still get the rest of Home.
    getShopDistributors(shopId).catch((error: unknown) => {
      if (error instanceof Error && error.message === "not_allowed") return null;
      throw error;
    }),
  ]);
  const firstName = session.fullName.split(" ")[0] ?? "";
  const owed = distributors
    ? distributors.reduce((sum, d) => sum + Math.max(d.balance_paisa, 0), 0)
    : null;
  const peak = Math.max(...dash.week.map((d) => d.sales_paisa), 1);

  const tiles: Tile[] = [
    {
      href: "/dukan/products",
      label: t("tiles.products"),
      icon: Boxes,
      tone: "bg-primary-soft text-primary-strong",
    },
    {
      href: "/dukan/wholesale",
      label: t("tiles.wholesale"),
      icon: Truck,
      tone: "bg-awning-soft text-awning-ink",
    },
    {
      href: "/dukan/customer-orders",
      label: t("tiles.orders"),
      icon: ShoppingBag,
      tone: "bg-subtle text-ink",
      badge: dash.counts.new,
    },
    { href: "/dukan/ledger", label: t("tiles.khata"), icon: BookOpen, tone: "bg-subtle text-ink" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-5">
      <section className="sheen relative overflow-hidden rounded-xl bg-forest p-5 text-on-forest shadow-raised inset-shadow-edge">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-on-forest/75">
              {firstName ? tHome("greetingNamed", { name: firstName }) : tHome("greeting")}
            </p>
            <h1 className="truncate font-heading text-2xl font-bold">{dash.shop.name}</h1>
          </div>
          <Link
            href="/dukan/store"
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold",
              dash.shop.is_live ? "bg-mint text-forest" : "bg-on-forest/15 text-on-forest",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-2 rounded-full",
                dash.shop.is_live ? "bg-forest" : "bg-on-forest/60",
              )}
            />
            {dash.shop.is_live ? t("online") : t("offline")}
            <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
          </Link>
        </div>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-on-forest/75">{t("todaySales")}</p>
            <p className="num font-heading text-4xl leading-tight font-extrabold">
              {formatRs(dash.today.sales_paisa)}
            </p>
            <p className="num mt-1 text-sm text-on-forest/80">
              {t("todayOrders", { count: dash.today.orders })} ·{" "}
              {t("delivered", { count: dash.today.delivered })}
            </p>
            <Link
              href="/dukan/reports"
              className="mt-3 inline-flex min-h-12 items-center gap-1.5 rounded-full bg-on-forest/15 px-4 text-sm font-semibold text-on-forest transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              <ChartColumn aria-hidden className="size-4" strokeWidth={1.75} />
              {t("report")}
              <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
            </Link>
          </div>
          <div className="flex h-16 items-end gap-1.5" role="img" aria-label={t("weekChart")}>
            {dash.week.map((day, index) => (
              <span
                key={day.day}
                className={cn(
                  "w-3 rounded-t-sm",
                  index === dash.week.length - 1 ? "bg-mint" : "bg-on-forest/30",
                )}
                style={{ height: `${Math.max((day.sales_paisa / peak) * 100, 6)}%` }}
              />
            ))}
          </div>
        </div>
      </section>

      {dash.shop.is_live ? null : <GoOnlineCard hasProducts={dash.stock.products > 0} />}

      <NotificationPrompt audience="dukandar" />

      <nav aria-label={t("quick")} className="grid grid-cols-4 gap-3">
        {tiles.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-border/60 bg-surface p-2 text-center shadow-card transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            <span className={cn("flex size-11 items-center justify-center rounded-md", tile.tone)}>
              <tile.icon aria-hidden className="size-5" strokeWidth={1.75} />
            </span>
            <span className="text-sm leading-tight font-semibold text-ink">{tile.label}</span>
            {tile.badge ? (
              <span className="num absolute end-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs font-bold text-on-danger">
                {tile.badge}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-ink">
            <span
              aria-hidden
              className={cn(
                "size-2.5 rounded-full",
                dash.counts.new > 0 ? "animate-pulse bg-danger" : "bg-primary",
              )}
            />
            {t("liveOrders")}
          </h2>
          <Link
            href="/dukan/customer-orders"
            className="inline-flex min-h-12 items-center gap-0.5 text-sm font-semibold text-primary"
          >
            {dash.counts.new > 0 ? t("newCount", { count: dash.counts.new }) : t("seeAll")}
            <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
          </Link>
        </div>
        {dash.queue.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {dash.queue.map((order) => (
              <QueueCard key={order.id} order={order} />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted">
            {dash.shop.is_live ? t("queueEmpty") : t("queueOffline")}
          </p>
        )}
      </section>

      <DukanPosters />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {dash.low_stock.length > 0 ? (
          <section className="flex flex-col gap-3 rounded-lg border border-danger/25 bg-danger-soft p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-danger-ink">
                <TriangleAlert aria-hidden className="size-5" />
                {t("lowStock")}
              </h2>
              <span className="num rounded-full bg-surface px-2.5 py-1 text-xs font-bold text-danger-ink">
                {t("lowCount", { count: dash.stock.low })}
              </span>
            </div>
            <ul className="grid grid-cols-2 gap-2">
              {dash.low_stock.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/dukan/search?q=${encodeURIComponent(item.name.split(" ").slice(0, 2).join(" "))}`}
                    className="flex h-full flex-col gap-0.5 rounded-md bg-surface px-3 py-2 shadow-card"
                  >
                    <span className="line-clamp-1 text-sm font-semibold text-ink">{item.name}</span>
                    <span className="num text-sm font-semibold text-danger-ink">
                      {t("left", { count: Math.max(Math.floor(item.qty_on_hand), 0) })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/dukan/wholesale"
              className="sheen flex min-h-12 items-center justify-center gap-2 rounded-md bg-action px-4 font-semibold text-on-action shadow-glow inset-shadow-edge"
            >
              <Truck aria-hidden className="size-5" />
              {t("restock")}
            </Link>
          </section>
        ) : null}

        <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-ink">
            <BookOpen aria-hidden className="size-5 text-primary" />
            {t("khataTitle")}
          </h2>
          <dl className="num grid grid-cols-2 gap-3">
            {owed === null ? null : (
              <div className="rounded-md bg-subtle p-3">
                <dt className="text-sm text-muted">{t("owed")}</dt>
                <dd className="font-heading text-xl font-bold text-ink">{formatRs(owed)}</dd>
              </div>
            )}
            <div className="rounded-md bg-subtle p-3">
              <dt className="text-sm text-muted">{t("incoming")}</dt>
              <dd className="font-heading text-xl font-bold text-ink">
                {t("incomingCount", { count: dash.incoming.orders })}
              </dd>
            </div>
            <div className="rounded-md bg-subtle p-3">
              <dt className="text-sm text-muted">{t("stockValue")}</dt>
              <dd className="font-heading text-xl font-bold text-ink">
                {formatRs(dash.stock.value_paisa)}
              </dd>
            </div>
            <div className="rounded-md bg-subtle p-3">
              <dt className="text-sm text-muted">{t("products")}</dt>
              <dd className="font-heading text-xl font-bold text-ink">{dash.stock.products}</dd>
            </div>
          </dl>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/dukan/ledger"
              className="flex min-h-12 items-center justify-center rounded-md bg-primary-soft px-3 text-sm font-semibold text-primary-strong"
            >
              {t("viewKhata")}
            </Link>
            <Link
              href="/dukan/orders"
              className="flex min-h-12 items-center justify-center gap-1.5 rounded-md bg-primary-soft px-3 text-sm font-semibold text-primary-strong"
            >
              <PackageOpen aria-hidden className="size-4" />
              {t("stockOrders")}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

/** The dukandar's home: today's sales, the live order queue, low stock and khata. */
export function ShopDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
