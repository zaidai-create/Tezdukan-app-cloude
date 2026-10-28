import { cn } from "cn";
import { ArrowLeft, BadgeMinus, Banknote, FileText, ReceiptText, Store } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { EmptyState } from "@/components/states/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";
import { formatRs } from "@/lib/money";
import { getLedger, requireDukan } from "../data";
import { ltr } from "../labels";
import type { LedgerEntry } from "../schemas";

type Props = { params: Promise<{ orgId: string }> };

const kindIcon: Record<LedgerEntry["kind"], typeof FileText> = {
  invoice: ReceiptText,
  payment: Banknote,
  credit_note: BadgeMinus,
  adjustment: FileText,
};

function StatementSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5" aria-hidden>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

async function StatementContent({ params }: Props) {
  await connection();
  const { orgId } = await params;
  if (!z.uuid().safeParse(orgId).success) notFound();
  const { shopId } = await requireDukan(`/dukan/ledger/${orgId}`);
  const [ledger, t] = await Promise.all([getLedger(shopId, orgId), getTranslations("ordering")]);
  const buckets = [
    {
      key: "current",
      label: t("ledger.agingCurrent"),
      value: ledger.aging.current,
      tone: "bg-primary",
    },
    { key: "d1_30", label: t("ledger.aging1"), value: ledger.aging.d1_30, tone: "bg-awning" },
    {
      key: "d31_60",
      label: t("ledger.aging31"),
      value: ledger.aging.d31_60,
      tone: "bg-awning-deep",
    },
    { key: "d61_90", label: t("ledger.aging61"), value: ledger.aging.d61_90, tone: "bg-danger" },
    {
      key: "d90_plus",
      label: t("ledger.aging90"),
      value: ledger.aging.d90_plus,
      tone: "bg-danger-ink",
    },
  ];
  const agingTotal = buckets.reduce((sum, b) => sum + b.value, 0);
  const entries = [...ledger.entries].reverse();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5">
      <header className="flex items-center gap-3">
        <Link
          href="/dukan/ledger"
          aria-label={t("ledger.title")}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface shadow-card"
        >
          <ArrowLeft aria-hidden className="size-5 rtl:-scale-x-100" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-heading text-2xl leading-tight font-extrabold text-ink">
            {ledger.org.name}
          </h1>
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Store aria-hidden className="size-4" />
            {t("ledger.title")}
          </p>
        </div>
      </header>

      <section className="sheen grid grid-cols-2 gap-4 rounded-xl bg-forest p-5 text-on-forest shadow-raised inset-shadow-edge">
        <div className="col-span-2">
          <p className="text-sm font-semibold text-on-forest/80">
            {ledger.balance_paisa > 0 ? t("ledger.balance") : t("ledger.noBalance")}
          </p>
          <p className="num font-heading text-4xl font-extrabold">
            {formatRs(Math.max(ledger.balance_paisa, 0))}
          </p>
        </div>
        <div>
          <p className="text-xs text-on-forest/70">{t("ledger.available")}</p>
          <p className="num font-heading text-lg font-bold">
            {formatRs(ledger.available_credit_paisa)}
          </p>
        </div>
        <div>
          <p className="text-xs text-on-forest/70">{t("ledger.creditLimit")}</p>
          <p className="num font-heading text-lg font-bold">
            {formatRs(ledger.credit_limit_paisa)}
          </p>
        </div>
        {ledger.payment_terms_days > 0 ? (
          <p className="num col-span-2 text-sm text-on-forest/85">
            {t("ledger.terms", { days: ledger.payment_terms_days })}
          </p>
        ) : null}
      </section>

      {agingTotal > 0 ? (
        <section className="rounded-lg border border-border/70 bg-surface p-4 shadow-card">
          <h2 className="mb-3 font-heading text-lg font-bold text-ink">{t("ledger.aging")}</h2>
          <div className="flex h-3 overflow-hidden rounded-full bg-subtle" aria-hidden>
            {buckets.map((b) =>
              b.value > 0 ? (
                <span
                  key={b.key}
                  className={b.tone}
                  style={{ width: `${(b.value / agingTotal) * 100}%` }}
                />
              ) : null,
            )}
          </div>
          <dl className="num mt-3 grid gap-1.5 text-sm">
            {buckets
              .filter((b) => b.value > 0)
              .map((b) => (
                <div key={b.key} className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-ink">
                    <span aria-hidden className={cn("size-2.5 rounded-full", b.tone)} />
                    {b.label}
                  </dt>
                  <dd className="font-semibold text-ink">{formatRs(b.value)}</dd>
                </div>
              ))}
          </dl>
        </section>
      ) : null}

      <section className="rounded-lg border border-border/70 bg-surface shadow-card">
        <h2 className="px-4 pt-4 font-heading text-lg font-bold text-ink">
          {t("ledger.statement")}
        </h2>
        {entries.length === 0 ? (
          <EmptyState icon={FileText} title={t("ledger.emptyStatement")} awning={false} />
        ) : (
          <ul className="divide-y divide-border/70 px-4">
            {entries.map((entry, index) => {
              const Icon = kindIcon[entry.kind];
              const debit = entry.debit_paisa > 0;
              return (
                <li key={`${entry.date}-${index}`} className="flex items-center gap-3 py-3">
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full",
                      debit
                        ? "bg-awning-soft text-awning-ink"
                        : "bg-primary-soft text-primary-strong",
                    )}
                  >
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {t(`ledger.kind.${entry.kind}`)}
                      {entry.reference ? (
                        <bdi className="num ms-1.5 font-normal text-muted">{entry.reference}</bdi>
                      ) : null}
                    </p>
                    <p className="num text-xs text-muted">{ltr(formatDate(entry.date))}</p>
                  </div>
                  <div className="num text-end">
                    <p
                      className={cn(
                        "font-heading font-bold",
                        debit ? "text-ink" : "text-primary-strong",
                      )}
                    >
                      {debit
                        ? formatRs(entry.debit_paisa, { signed: true })
                        : formatRs(-entry.credit_paisa)}
                    </p>
                    <p className="text-xs text-muted">
                      {t("ledger.runningBalance", { amount: formatRs(entry.balance_paisa) })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/** One distributor's statement for this dukan: balance, credit, aging and every entry. */
export function LedgerStatement(props: Props) {
  return (
    <Suspense fallback={<StatementSkeleton />}>
      <StatementContent {...props} />
    </Suspense>
  );
}
