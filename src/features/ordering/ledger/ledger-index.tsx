import { ChevronRight, Store, Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import { formatRs } from "@/lib/money";
import { getShopDistributors, requireDukan } from "../data";
import { accountTone } from "../listing/distributors-index";

function LedgerIndexSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5" aria-hidden>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}

async function LedgerIndexContent() {
  await connection();
  const { shopId } = await requireDukan("/dukan/ledger");
  const [distributors, t] = await Promise.all([
    getShopDistributors(shopId),
    getTranslations("ordering"),
  ]);
  const owed = distributors.reduce((sum, d) => sum + Math.max(d.balance_paisa, 0), 0);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5">
      <div>
        <h1 className="font-heading text-2xl font-extrabold text-ink lg:text-3xl">
          {t("ledger.title")}
        </h1>
        <p className="mt-1 text-sm text-muted">{t("ledger.hint")}</p>
      </div>

      <section className="sheen flex items-center gap-4 rounded-xl bg-forest p-5 text-on-forest shadow-raised inset-shadow-edge">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-on-forest/12">
          <Wallet aria-hidden className="size-7" />
        </span>
        <div>
          <p className="text-sm font-semibold text-on-forest/80">
            {owed > 0 ? t("ledger.balance") : t("ledger.noBalance")}
          </p>
          <p className="num font-heading text-3xl font-extrabold">{formatRs(owed)}</p>
        </div>
      </section>

      {distributors.length === 0 ? (
        <EmptyState icon={Store} title={t("ledger.none")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {distributors.map((d) => {
            const used =
              d.credit_limit_paisa > 0
                ? Math.min(1, Math.max(0, d.balance_paisa) / d.credit_limit_paisa)
                : 0;
            return (
              <li key={d.org_id}>
                <Link
                  href={`/dukan/ledger/${d.org_id}`}
                  className="flex flex-col gap-3 rounded-lg border border-border/70 bg-surface p-4 shadow-card transition-transform active:scale-[0.99]"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-strong">
                      <Store aria-hidden className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-heading font-bold text-ink">
                        {d.name}
                      </span>
                      <StatusBadge tone={accountTone[d.account_status]} className="mt-1">
                        {t(`distributors.status.${d.account_status}`)}
                      </StatusBadge>
                    </span>
                    <span className="text-end">
                      <span className="num block font-heading text-lg font-extrabold text-ink">
                        {formatRs(Math.max(d.balance_paisa, 0))}
                      </span>
                      <span className="flex items-center justify-end gap-0.5 text-xs font-semibold text-primary-strong">
                        {t("ledger.open")}
                        <ChevronRight aria-hidden className="size-3.5 rtl:-scale-x-100" />
                      </span>
                    </span>
                  </span>
                  {d.credit_limit_paisa > 0 ? (
                    <span className="flex flex-col gap-1.5">
                      <span
                        className="h-2 overflow-hidden rounded-full bg-subtle-strong"
                        aria-hidden
                      >
                        <span
                          className={
                            used > 0.8
                              ? "block h-full rounded-full bg-danger"
                              : "block h-full rounded-full bg-primary"
                          }
                          style={{ width: `${Math.max(used * 100, 2)}%` }}
                        />
                      </span>
                      <span className="num flex justify-between text-xs text-muted">
                        <span>{t("ledger.creditLimit")}</span>
                        <span>{formatRs(d.credit_limit_paisa)}</span>
                      </span>
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** What the dukan owes each distributor, read from the distributors' own books. */
export function LedgerIndex() {
  return (
    <Suspense fallback={<LedgerIndexSkeleton />}>
      <LedgerIndexContent />
    </Suspense>
  );
}
