import { cn } from "cn";
import { ChevronRight, Package, Store, Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { ListRowSkeleton } from "@/components/states/skeletons";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";
import { formatRs } from "@/lib/money";
import { listOrders, requireDukan } from "../data";
import { deliveryDay, ltr, slotWindow } from "../labels";
import { first } from "../listing/params";
import type { OrderRow } from "../schemas";
import { isOpen, statusTone } from "./status";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function OrdersSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5" aria-hidden>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-11 w-full rounded-full" />
      <div className="rounded-lg border border-border bg-surface px-4">
        <ListRowSkeleton />
        <ListRowSkeleton />
        <ListRowSkeleton />
      </div>
    </div>
  );
}

async function OrderRowLink({ order }: { order: OrderRow }) {
  const t = await getTranslations("ordering");
  const open = isOpen(order.status);
  return (
    <li>
      <Link
        href={`/dukan/orders/${order.id}`}
        className="flex gap-3 rounded-lg border border-border/70 bg-surface p-4 shadow-card transition-transform active:scale-[0.99]"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-strong">
          <Store aria-hidden className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="truncate font-heading text-base font-bold text-ink">
              {order.organizations?.name ?? order.order_number}
            </span>
            <StatusBadge tone={statusTone[order.status]}>{t(`status.${order.status}`)}</StatusBadge>
          </span>
          <span className="num mt-0.5 block text-sm text-muted">
            {order.order_number} ·{" "}
            {t("orders.placedOn", { date: ltr(formatDate(order.created_at)) })}
          </span>
          <span className="mt-2 flex items-end justify-between gap-2">
            <span className="num text-sm text-ink">
              {open && order.delivery_slot_start && order.delivery_slot_end
                ? t("orders.deliveryWindow", {
                    date: deliveryDay(t, order.delivery_slot_start),
                    window: slotWindow(t, order.delivery_slot_start, order.delivery_slot_end),
                  })
                : order.delivered_at
                  ? t("orders.deliveredOn", { date: ltr(formatDate(order.delivered_at)) })
                  : t(`payment.${order.payment_method}`)}
            </span>
            <span className="num flex shrink-0 items-center gap-1 font-heading text-base font-extrabold whitespace-nowrap text-ink">
              {formatRs(order.total_paisa)}
              <ChevronRight aria-hidden className="size-4 text-muted rtl:-scale-x-100" />
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}

async function OrdersContent({ searchParams }: Props) {
  await connection();
  const { shopId } = await requireDukan("/dukan/orders");
  const tab = first((await searchParams).tab) === "past" ? "past" : "open";
  const [orders, t] = await Promise.all([listOrders(shopId, tab), getTranslations("ordering")]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-extrabold text-ink lg:text-3xl">
          {t("orders.title")}
        </h1>
        <Link
          href="/dukan/ledger"
          className="inline-flex h-11 items-center gap-1.5 rounded-full bg-awning-soft px-4 text-sm font-semibold text-awning-ink"
        >
          <Wallet aria-hidden className="size-4" />
          {t("orders.khata")}
        </Link>
      </div>
      <nav
        aria-label={t("orders.title")}
        className="grid grid-cols-2 gap-1 rounded-full bg-subtle p-1"
      >
        {(["open", "past"] as const).map((value) => (
          <Link
            key={value}
            href={value === "open" ? "/dukan/orders" : "/dukan/orders?tab=past"}
            aria-current={tab === value ? "page" : undefined}
            scroll={false}
            className={cn(
              "flex h-11 items-center justify-center rounded-full text-sm font-semibold transition-colors",
              tab === value ? "bg-surface text-ink shadow-card" : "text-muted",
            )}
          >
            {t(`orders.${value}`)}
          </Link>
        ))}
      </nav>
      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title={tab === "open" ? t("orders.emptyOpen") : t("orders.emptyPast")}
          description={t("orders.emptyHint")}
          action={
            <Link href="/dukan" className={buttonVariants({ size: "lg" })}>
              {t("cart.startShopping")}
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <OrderRowLink key={order.id} order={order} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** The dukan's orders to distributors: active ones first, past ones a tap away. */
export function OrdersPage(props: Props) {
  return (
    <Suspense fallback={<OrdersSkeleton />}>
      <OrdersContent {...props} />
    </Suspense>
  );
}
