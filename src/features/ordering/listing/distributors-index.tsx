import { ChevronRight, MapPin, Star, Store, Truck, Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import { formatRs } from "@/lib/money";
import { getShopDistributors, requireDukan } from "../data";
import type { AccountStatus, ShopDistributor } from "../schemas";

export const accountTone: Record<AccountStatus, StatusTone> = {
  active: "success",
  on_hold: "warning",
  blocked: "danger",
  none: "neutral",
};

function DistributorsSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6" aria-hidden>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
      {Array.from({ length: 2 }, (_, i) => (
        <Skeleton key={i} className="h-44 w-full rounded-lg" />
      ))}
    </div>
  );
}

async function DistributorCard({ d }: { d: ShopDistributor }) {
  const t = await getTranslations("ordering");
  const delivery =
    d.delivery_fee_paisa === 0
      ? t("distributors.deliveryFree")
      : d.free_delivery_above_paisa !== null
        ? `${t("distributors.deliveryFee", { amount: formatRs(d.delivery_fee_paisa) })} · ${t("distributors.deliveryFreeAbove", { amount: formatRs(d.free_delivery_above_paisa) })}`
        : t("distributors.deliveryFee", { amount: formatRs(d.delivery_fee_paisa) });
  return (
    <li className="rounded-lg border border-border/70 bg-surface shadow-card">
      <div className="flex items-start gap-3 p-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-strong">
          <Store aria-hidden className="size-7" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-heading text-lg leading-tight font-bold text-ink">{d.name}</h2>
            <span className="num flex shrink-0 items-center gap-1 rounded-full bg-awning-soft px-2 py-1 text-xs font-bold text-awning-ink">
              <Star aria-hidden className="size-3.5 fill-current" />
              {d.rating !== null
                ? t("distributors.rating", { rating: d.rating.toFixed(1), count: d.rating_count })
                : t("distributors.noRating")}
            </span>
          </div>
          {d.area_name ? (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
              <MapPin aria-hidden className="size-4" />
              {d.area_name}
            </p>
          ) : null}
          <ul className="num mt-3 flex flex-col gap-1.5 text-sm text-ink">
            <li className="flex items-center gap-2">
              <Truck aria-hidden className="size-4 text-muted" />
              {t("distributors.minimum", { amount: formatRs(d.min_order_paisa) })} · {delivery}
            </li>
            <li className="flex items-center gap-2">
              <Wallet aria-hidden className="size-4 text-muted" />
              {d.balance_paisa > 0
                ? t("khataDue", { amount: formatRs(d.balance_paisa) })
                : t("khataClear")}
            </li>
          </ul>
          <div className="mt-3">
            <StatusBadge tone={accountTone[d.account_status]}>
              {t(`distributors.status.${d.account_status}`)}
            </StatusBadge>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 border-t border-border/70">
        <Link
          href={`/dukan/distributors/${d.org_id}`}
          className="flex min-h-12 items-center justify-center gap-1 border-e border-border/70 text-sm font-semibold text-primary-strong"
        >
          {t("distributors.browse")}
          <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
        </Link>
        <Link
          href={`/dukan/ledger/${d.org_id}`}
          className="flex min-h-12 items-center justify-center gap-1 text-sm font-semibold text-primary-strong"
        >
          {t("ledger.open")}
          <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
        </Link>
      </div>
    </li>
  );
}

async function DistributorsContent() {
  await connection();
  const { shopId } = await requireDukan("/dukan/distributors");
  const [distributors, t] = await Promise.all([
    getShopDistributors(shopId),
    getTranslations("ordering"),
  ]);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
      <div>
        <h1 className="font-heading text-2xl font-extrabold text-ink lg:text-3xl">
          {t("distributors.title")}
        </h1>
        <p className="mt-1 text-sm text-muted">{t("distributors.hint")}</p>
      </div>
      {distributors.length === 0 ? (
        <EmptyState icon={Store} title={t("ledger.none")} />
      ) : (
        <ul className="flex flex-col gap-4">
          {distributors.map((d) => (
            <DistributorCard key={d.org_id} d={d} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** The distributors that deliver to this dukan, with their terms and the dukan's account. */
export function DistributorsIndex() {
  return (
    <Suspense fallback={<DistributorsSkeleton />}>
      <DistributorsContent />
    </Suspense>
  );
}
