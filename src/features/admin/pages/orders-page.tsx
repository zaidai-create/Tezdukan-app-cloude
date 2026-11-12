import { Package, ShoppingBag, Truck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { cn } from "cn";
import { EmptyState } from "@/components/states/empty-state";
import { ListRowSkeleton } from "@/components/states/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/session";
import { formatRs } from "@/lib/money";
import {
  AdminHeader,
  AdminPageShell,
  LinkTabs,
  ListCard,
  OrderTag,
  TableHead,
} from "../components/admin-ui";
import { SearchBox } from "../components/search-box";
import { TimeAgo } from "../components/time-ago";
import { getAdminOrders } from "../data";
import { adminOrderKindSchema, adminOrderKinds } from "../schemas";
import { first, type SearchParams } from "./shared";

// Order, from → to, items, status, total, placed: the table on a wide screen.
const orderColumns = "lg:grid-cols-[9rem_minmax(0,2.6fr)_6rem_8.5rem_7rem_8rem]";

async function OrdersContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  await requireRole("admin", "/admin/orders");
  const params = await searchParams;
  const kind = adminOrderKindSchema.parse(first(params.kind));
  const query = first(params.q) ?? "";
  const [t, tCustomer, tB2b, orders] = await Promise.all([
    getTranslations("admin"),
    getTranslations("customerOrders.status"),
    getTranslations("ordering.status"),
    getAdminOrders(kind, query),
  ]);
  const href = (next: string) => {
    const search = new URLSearchParams();
    if (next !== "all") search.set("kind", next);
    if (query) search.set("q", query);
    const text = search.toString();
    return text ? `/admin/orders?${text}` : "/admin/orders";
  };
  return (
    <AdminPageShell>
      <AdminHeader title={t("orders.title")} subtitle={t("orders.subtitle")} />
      <LinkTabs
        label={t("directory.filter")}
        items={adminOrderKinds.map((option) => ({
          href: href(option),
          label: t(`orders.kind.${option}`),
          active: option === kind,
        }))}
      />
      <SearchBox label={t("directory.search")} placeholder={t("orders.search")} />
      {orders.length === 0 ? (
        <EmptyState icon={Package} title={t("orders.empty")} />
      ) : (
        <ListCard label={t("orders.title")}>
          <TableHead
            columns={orderColumns}
            labels={[
              t("table.order"),
              t("table.fromTo"),
              t("table.items"),
              t("table.status"),
              t("table.total"),
              t("table.placed"),
            ]}
          />
          {orders.map((order) => (
            <li
              key={`${order.kind}-${order.id}`}
              className={cn("flex items-center gap-3 px-4 py-3 lg:grid lg:gap-4", orderColumns)}
            >
              {/* Wide screen: one table row. */}
              <span className="num hidden items-center gap-2 text-sm font-semibold text-ink lg:flex">
                {order.kind === "customer" ? (
                  <ShoppingBag
                    aria-hidden
                    className="size-4 text-primary-strong"
                    strokeWidth={1.75}
                  />
                ) : (
                  <Truck aria-hidden className="size-4 text-awning-ink" strokeWidth={1.75} />
                )}
                {order.number}
              </span>
              <span className="hidden truncate text-sm text-ink lg:block">
                {order.buyer ? `${order.seller} → ${order.buyer}` : order.seller}
              </span>
              <span className="num hidden text-sm text-ink lg:block">
                {t("orders.items", { count: order.items_count })}
              </span>
              <span className="hidden lg:block">
                <OrderTag
                  status={order.status}
                  label={
                    order.kind === "customer"
                      ? tCustomer(order.status as "placed")
                      : tB2b(order.status as "new")
                  }
                />
              </span>
              <span className="num hidden text-sm font-bold text-ink lg:block">
                {formatRs(order.total_paisa)}
              </span>
              <span className="num hidden text-sm text-muted lg:block">
                <TimeAgo value={order.created_at} />
              </span>

              {/* Phone: a compact row. */}
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-md lg:hidden",
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
              <span className="min-w-0 flex-1 lg:hidden">
                <span className="block truncate text-sm font-semibold text-ink">
                  {order.buyer ? `${order.seller} → ${order.buyer}` : order.seller}
                </span>
                <span className="num block truncate text-xs text-muted">
                  {order.number}
                  {" · "}
                  {t("orders.items", { count: order.items_count })}
                  {" · "}
                  <TimeAgo value={order.created_at} />
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1 lg:hidden">
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
    </AdminPageShell>
  );
}

/** Customer orders and dukan orders from distributors, newest first. */
export function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <AdminPageShell>
          <Skeleton className="h-10 w-40 rounded-md" />
          <Skeleton className="h-12 w-full rounded-full" />
          <div className="rounded-lg border border-border bg-surface px-4">
            <ListRowSkeleton />
            <ListRowSkeleton />
          </div>
        </AdminPageShell>
      }
    >
      <OrdersContent searchParams={searchParams} />
    </Suspense>
  );
}
