import { cn } from "cn";
import { ChevronRight, PhoneCall, ShieldCheck, Sparkles, Store } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { StatusBadge } from "@/components/ui/status-badge";
import { statusTone } from "@/features/ordering/orders/status";
import { Link } from "@/i18n/navigation";
import { formatTime } from "@/lib/format";
import { formatRs } from "@/lib/money";
import { ltr } from "@/features/ordering/labels";
import type { InboxOrder } from "../schemas";

/** Whether a new order still waits for its confirmation call. */
export function awaitingConfirmation(
  order: Pick<
    InboxOrder,
    "status" | "needs_confirmation" | "phone_confirmed_at" | "shop_confirmed_at"
  >,
): boolean {
  return (
    order.status === "new" &&
    order.needs_confirmation &&
    order.phone_confirmed_at === null &&
    order.shop_confirmed_at === null
  );
}

/** One order in the distributor's inbox: who, how much, and whether it needs a call first. */
export async function OrderCard({ order }: { order: InboxOrder }) {
  const [t, tStatus] = await Promise.all([
    getTranslations("distributor.inbox"),
    getTranslations("ordering"),
  ]);
  const waiting = awaitingConfirmation(order);

  return (
    <li>
      <Link
        href={`/distributor/orders/${order.id}`}
        className={cn(
          "flex gap-3 rounded-lg border bg-surface p-4 shadow-card transition-transform active:scale-[0.99]",
          waiting ? "border-awning/70" : "border-border/70",
        )}
      >
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-md",
            waiting ? "bg-awning-soft text-awning-ink" : "bg-primary-soft text-primary-strong",
          )}
        >
          {waiting ? (
            <PhoneCall aria-hidden className="size-5" />
          ) : (
            <Store aria-hidden className="size-5" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="truncate font-heading text-base font-bold text-ink">
              {order.shop.name}
            </span>
            <span className="num flex shrink-0 items-center gap-1 font-heading text-base font-extrabold whitespace-nowrap text-ink">
              {formatRs(order.total_paisa)}
              <ChevronRight aria-hidden className="size-4 text-muted rtl:-scale-x-100" />
            </span>
          </span>
          <span className="num mt-0.5 block truncate text-sm text-muted">
            {[
              order.shop.area_name,
              t("items", { count: order.item_count }),
              tStatus(`payment.${order.payment_method}`),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge tone={statusTone[order.status]}>
              {tStatus(`status.${order.status}`)}
            </StatusBadge>
            {waiting ? (
              <StatusBadge tone="warning" icon={PhoneCall}>
                {t("callToConfirm")}
              </StatusBadge>
            ) : order.status === "new" && order.shop_confirmed_at ? (
              <StatusBadge tone="success" icon={ShieldCheck}>
                {t("confirmedByShop")}
              </StatusBadge>
            ) : null}
            {order.status === "new" && order.confirmation_reasons.includes("first_order") ? (
              <StatusBadge tone="neutral" icon={Sparkles}>
                {t("firstOrder")}
              </StatusBadge>
            ) : null}
            <span className="num ms-auto text-xs text-muted">
              {order.order_number} · {ltr(formatTime(order.created_at))}
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}
