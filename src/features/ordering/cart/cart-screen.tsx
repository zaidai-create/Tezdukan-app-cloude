"use client";

import { cn } from "cn";
import {
  ArrowRight,
  BadgePercent,
  CircleAlert,
  Gift,
  ShoppingBasket,
  Store,
  Trash2,
  Truck,
  Wallet,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { AddToCart } from "@/components/commerce/add-to-cart";
import { ProductImage } from "@/components/commerce/product-image";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import { formatRs } from "@/lib/money";
import { categoryIcon } from "../category-style";
import { storageUrl } from "../images";
import { localName } from "../labels";
import { useCart, useSetCartItem } from "../queries";
import type { CartGroup, CartLine } from "../schemas";

/** Lines that stop checkout: unavailable, below MOQ, or short of stock. */
export function groupBlocked(group: CartGroup): boolean {
  return (
    !group.meets_minimum ||
    group.account_status === "blocked" ||
    group.items.some((line) => line.problems.length > 0)
  );
}

function Progress({ value, tone = "primary" }: { value: number; tone?: "primary" | "awning" }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-subtle-strong" aria-hidden>
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300 ease-out",
          tone === "primary" ? "bg-primary" : "bg-awning",
        )}
        style={{ width: `${Math.min(100, Math.max(4, value * 100))}%` }}
      />
    </div>
  );
}

function LineRow({ line, shopId }: { line: CartLine; shopId: string }) {
  const t = useTranslations("ordering");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const setCartItem = useSetCartItem(shopId);
  const name = line.item ? localName(line.item, locale) : line.pack_label;
  const change = (quantity: number) =>
    setCartItem({
      productId: line.distributor_product_id,
      unitId: line.pack_unit_id,
      quantity,
      previous: line.quantity,
      name,
    });
  const problem = line.problems[0];

  return (
    <li className="flex gap-3 py-3">
      <ProductImage
        src={storageUrl(line.item?.image_path)}
        alt={name}
        sizes="64px"
        fallbackIcon={line.item ? categoryIcon(line.item.category_slug ?? "") : undefined}
        className="size-16 shrink-0 rounded-md"
      />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm leading-5 font-semibold text-ink">{name}</p>
        <p className="num text-xs text-muted">
          {line.pack_label} · {formatRs(line.unit_price_paisa)}
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {line.free_base_qty > 0 ? (
            <span className="num inline-flex items-center gap-1 rounded-sm bg-primary-soft px-1.5 py-0.5 text-xs font-bold text-primary-strong">
              <Gift aria-hidden className="size-3.5" />
              {t("cart.free", { count: line.free_base_qty })}
            </span>
          ) : null}
          {line.scheme_applied && line.line_discount_paisa > 0 ? (
            <span className="num inline-flex items-center gap-1 rounded-sm bg-awning-soft px-1.5 py-0.5 text-xs font-bold text-awning-ink">
              <BadgePercent aria-hidden className="size-3.5" />
              {formatRs(-line.line_discount_paisa)}
            </span>
          ) : null}
        </div>
        {problem ? (
          <p className="mt-1 flex items-start gap-1 text-xs font-semibold text-danger-ink">
            <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
            {t(`cart.problem.${problem}`, {
              count:
                problem === "below_moq"
                  ? (line.item?.moq_base_qty ?? 1)
                  : (line.item?.available_base_qty ?? 0),
            })}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between gap-2">
        <p className="num font-heading text-base font-bold text-ink">
          {formatRs(line.line_total_paisa)}
        </p>
        {line.item ? (
          <AddToCart quantity={line.quantity} productName={name} onQuantityChange={change} />
        ) : (
          <button
            type="button"
            onClick={() => change(0)}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-danger-soft px-3 text-sm font-semibold text-danger-ink"
          >
            <Trash2 aria-hidden className="size-4" />
            {tCommon("remove")}
          </button>
        )}
      </div>
    </li>
  );
}

function GroupCard({ group, shopId }: { group: CartGroup; shopId: string }) {
  const t = useTranslations("ordering");
  const net = group.subtotal_paisa - group.scheme_discount_paisa;
  const freeAbove = group.free_delivery_above_paisa;
  return (
    <section
      aria-label={t("cart.fromDistributor", { name: group.org_name })}
      className="rounded-lg border border-border/70 bg-surface shadow-card"
    >
      <header className="flex items-center gap-3 border-b border-border/70 p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-strong">
          <Store aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-heading text-base font-bold text-ink">
            {t("cart.fromDistributor", { name: group.org_name })}
          </h2>
          <p className="num text-xs text-muted">{t("cart.items", { count: group.items.length })}</p>
        </div>
        {group.account_status === "on_hold" ? (
          <StatusBadge tone="warning">{t("distributors.status.on_hold")}</StatusBadge>
        ) : group.account_status === "blocked" ? (
          <StatusBadge tone="danger">{t("distributors.status.blocked")}</StatusBadge>
        ) : null}
      </header>

      <div className="flex flex-col gap-3 px-4 pt-3">
        {!group.meets_minimum ? (
          <div className="flex flex-col gap-1.5 rounded-md bg-awning-soft p-3">
            <p className="num text-sm font-semibold text-awning-ink">
              {t("cart.minimumShort", {
                amount: formatRs(group.short_by_paisa),
                name: group.org_name,
                minimum: formatRs(group.min_order_paisa),
              })}
            </p>
            <Progress value={net / Math.max(group.min_order_paisa, 1)} tone="awning" />
          </div>
        ) : freeAbove !== null && group.delivery_fee_paisa > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="num flex items-center gap-1.5 text-sm font-semibold text-primary-strong">
              <Truck aria-hidden className="size-4" />
              {net >= freeAbove
                ? t("cart.freeDeliveryReached")
                : t("cart.freeDeliveryShort", { amount: formatRs(freeAbove - net) })}
            </p>
            <Progress value={net / Math.max(freeAbove, 1)} />
          </div>
        ) : null}
        {group.account_status === "blocked" ? (
          <p className="text-sm font-semibold text-danger-ink">
            {t("cart.accountBlocked", { name: group.org_name })}
          </p>
        ) : group.account_status === "on_hold" ? (
          <p className="text-sm font-semibold text-awning-ink">{t("cart.accountOnHold")}</p>
        ) : null}
      </div>

      <ul className="divide-y divide-border/70 px-4">
        {group.items.map((line) => (
          <LineRow key={line.cart_item_id} line={line} shopId={shopId} />
        ))}
      </ul>

      <dl className="num flex flex-col gap-1.5 border-t border-border/70 p-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">{t("cart.subtotal")}</dt>
          <dd className="text-ink">{formatRs(group.subtotal_paisa)}</dd>
        </div>
        {group.scheme_discount_paisa > 0 ? (
          <div className="flex justify-between">
            <dt className="text-muted">{t("cart.schemeDiscount")}</dt>
            <dd className="font-semibold text-primary-strong">
              {formatRs(-group.scheme_discount_paisa)}
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt className="text-muted">{t("cart.deliveryFee")}</dt>
          <dd className="text-ink">
            {group.delivery_charge_paisa === 0
              ? t("cart.deliveryFree")
              : formatRs(group.delivery_charge_paisa)}
          </dd>
        </div>
        <div className="mt-1 flex justify-between font-heading text-base font-bold text-ink">
          <dt>{t("cart.total")}</dt>
          <dd>{formatRs(group.total_paisa)}</dd>
        </div>
        {group.account_status !== "none" && group.account_status !== "blocked" ? (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <Wallet aria-hidden className="size-3.5" />
            {t("cart.credit", { amount: formatRs(group.credit_available_paisa) })}
          </p>
        ) : null}
      </dl>
    </section>
  );
}

/** The cart, split by distributor, with each one's minimum, delivery fee and totals. */
function CartScreen({ shopId }: { shopId: string }) {
  const t = useTranslations("ordering");
  const cart = useCart(shopId);

  if (cart.isError && !cart.data) {
    return <ErrorState onRetry={() => void cart.refetch()} retrying={cart.isFetching} />;
  }
  const summary = cart.data;
  if (!summary || summary.groups.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBasket}
        title={t("cart.emptyTitle")}
        description={t("cart.emptyHint")}
        action={
          <Link href="/dukan" className={buttonVariants({ size: "lg" })}>
            {t("cart.startShopping")}
          </Link>
        }
      />
    );
  }
  const blocked = summary.groups.some(groupBlocked);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5">
      <div>
        <h1 className="font-heading text-2xl font-extrabold text-ink lg:text-3xl">
          {t("cart.title")}
        </h1>
        <p className="num mt-1 text-sm text-muted">
          {t("cart.splitNote", { count: summary.groups.length })}
        </p>
      </div>
      {summary.groups.map((group) => (
        <GroupCard key={group.org_id} group={group} shopId={shopId} />
      ))}

      <div className="material sticky bottom-[calc(var(--bottom-nav-space)+10px)] z-30 rounded-2xl p-1.5 shadow-float lg:bottom-6">
        <Link
          href="/dukan/checkout"
          aria-disabled={blocked || undefined}
          tabIndex={blocked ? -1 : undefined}
          className={cn(
            buttonVariants({ size: "lg", block: true }),
            "h-16 justify-between rounded-xl px-5 text-lg",
            blocked && "pointer-events-none opacity-50",
          )}
        >
          <span className="num">
            {t("cart.checkoutTotal", { total: formatRs(summary.total_paisa) })}
          </span>
          <ArrowRight aria-hidden className="size-6 rtl:-scale-x-100" />
        </Link>
      </div>
    </div>
  );
}

export { CartScreen };
