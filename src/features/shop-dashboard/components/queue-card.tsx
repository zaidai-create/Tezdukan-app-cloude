"use client";

import { Check, ChevronRight, MapPin, PackageCheck, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { updateCustomerOrderStatus } from "@/features/customer-orders/actions";
import type { CustomerOrderStatus } from "@/features/customer-orders/schemas";
import { Link } from "@/i18n/navigation";
import { useRelativeTime } from "@/hooks/use-relative-time";
import { haptic } from "@/lib/haptics";
import { formatRs } from "@/lib/money";
import type { QueueOrder } from "../schemas";

type NextStep = "accepted" | "packed" | "out_for_delivery" | "delivered";

const next: Partial<Record<CustomerOrderStatus, NextStep>> = {
  placed: "accepted",
  accepted: "packed",
  packed: "out_for_delivery",
  out_for_delivery: "delivered",
};

/** One live order with its next step a tap away, like the counter queue in a busy dukan. */
export function QueueCard({ order }: { order: QueueOrder }) {
  const t = useTranslations("shopDash");
  const tOrders = useTranslations("customerOrders");
  const [pending, startTransition] = useTransition();
  const ago = useRelativeTime(order.created_at);
  const to = next[order.status];
  const Icon = to === "accepted" ? Check : to === "out_for_delivery" ? Truck : PackageCheck;

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
      <Link href={`/dukan/customer-orders/${order.id}`} className="flex items-start gap-3">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="num font-heading text-base font-bold text-ink">
              {order.order_number}
            </span>
            <StatusBadge tone={order.status === "placed" ? "warning" : "neutral"}>
              {tOrders(`status.${order.status}`)}
            </StatusBadge>
          </span>
          <span className="mt-0.5 block truncate font-semibold text-ink">
            {order.customer_name ?? tOrders("customer")}
            <span className="font-normal text-muted"> · {ago}</span>
          </span>
          {order.address ? (
            <span className="flex items-center gap-1 truncate text-sm text-muted">
              <MapPin aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">{order.address}</span>
            </span>
          ) : null}
        </span>
        <span className="flex flex-col items-end">
          <span className="num font-heading text-lg font-bold text-ink">
            {formatRs(order.total_paisa)}
          </span>
          <span className="num text-sm text-muted">{t("items", { count: order.items_count })}</span>
        </span>
      </Link>
      {order.items_preview ? (
        <p className="truncate rounded-md bg-subtle px-3 py-2 text-sm text-ink">
          {order.items_preview}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Link
          href={`/dukan/customer-orders/${order.id}`}
          className="inline-flex h-12 items-center gap-1 rounded-md bg-subtle px-4 text-sm font-semibold text-ink"
        >
          {t("open")}
          <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
        </Link>
        {to ? (
          <Button
            size="lg"
            className="min-w-0 flex-1"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await updateCustomerOrderStatus(order.id, to);
                if (!result.ok) {
                  haptic("warning");
                  toast.error(tOrders(`errors.${result.error}`));
                  return;
                }
                haptic("success");
                toast.success(tOrders(`moved.${to}`));
              })
            }
          >
            <Icon aria-hidden />
            <span className="truncate">{t(`next.${to}`)}</span>
          </Button>
        ) : null}
      </div>
    </article>
  );
}
