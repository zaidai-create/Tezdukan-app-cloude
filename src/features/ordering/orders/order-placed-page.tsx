import { CalendarClock, Check, Store } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { SpeedLines } from "@/components/brand/speed-lines";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, redirect } from "@/i18n/navigation";
import { formatRs } from "@/lib/money";
import { listOrders, requireDukan } from "../data";
import { deliveryDay, slotWindow } from "../labels";
import { first } from "../listing/params";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function PlacedSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-10"
      aria-hidden
    >
      <Skeleton className="size-24 rounded-full" />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}

async function PlacedContent({ searchParams }: Props) {
  await connection();
  const { session, shopId } = await requireDukan("/dukan/orders");
  const ids = (first((await searchParams).ids) ?? "")
    .split(",")
    .filter((id) => z.uuid().safeParse(id).success);
  const t = await getTranslations("ordering");
  const orders = (await listOrders(shopId, "all")).filter((o) => ids.includes(o.id));
  if (orders.length === 0) redirect({ href: "/dukan/orders", locale: session.locale });

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 px-4 py-8 text-center">
      <div className="relative flex items-center">
        <SpeedLines animated className="absolute -start-14 top-1/2 w-12 -translate-y-1/2" />
        <span className="sheen flex size-24 animate-pop items-center justify-center rounded-full bg-action text-on-action shadow-glow inset-shadow-edge">
          <Check aria-hidden className="size-12 stroke-[2.5]" />
        </span>
      </div>
      <div className="animate-rise" style={{ animationDelay: "150ms" }}>
        <h1 className="font-heading text-3xl font-extrabold text-ink">
          {orders.length > 1
            ? t("success.titleMany", { count: orders.length })
            : t("success.title")}
        </h1>
        <p className="mt-2 text-base text-muted">{t("success.body")}</p>
      </div>

      <ul className="flex w-full flex-col gap-3 text-start">
        {orders.map((order, index) => (
          <li
            key={order.id}
            className="animate-rise rounded-lg border border-border/70 bg-surface p-4 shadow-card"
            style={{ animationDelay: `${250 + index * 80}ms` }}
          >
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-strong">
                <Store aria-hidden className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading font-bold text-ink">
                  {order.organizations?.name}
                </p>
                <p className="num text-sm text-muted">
                  {t("success.orderNumber", { number: order.order_number })}
                </p>
              </div>
              <p className="num font-heading text-lg font-extrabold text-ink">
                {formatRs(order.total_paisa)}
              </p>
            </div>
            {order.delivery_slot_start && order.delivery_slot_end ? (
              <p className="num mt-3 flex items-center gap-1.5 rounded-md bg-subtle px-3 py-2 text-sm text-ink">
                <CalendarClock aria-hidden className="size-4 text-primary-strong" />
                {t("orders.deliveryWindow", {
                  date: deliveryDay(t, order.delivery_slot_start),
                  window: slotWindow(t, order.delivery_slot_start, order.delivery_slot_end),
                })}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="flex w-full flex-col gap-3">
        <Link
          href={
            orders.length === 1 && orders[0] ? `/dukan/orders/${orders[0].id}` : "/dukan/orders"
          }
          className={buttonVariants({ size: "lg", block: true })}
        >
          {orders.length === 1 ? t("success.track") : t("success.trackAll")}
        </Link>
        <Link
          href="/dukan"
          className={buttonVariants({ size: "lg", block: true, variant: "soft" })}
        >
          {t("success.continue")}
        </Link>
      </div>
    </div>
  );
}

/** After checkout: the orders just placed, each distributor's delivery window, what next. */
export function OrderPlacedPage(props: Props) {
  return (
    <Suspense fallback={<PlacedSkeleton />}>
      <PlacedContent {...props} />
    </Suspense>
  );
}
