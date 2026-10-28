"use client";

import { cn } from "cn";
import { Calculator, ChevronDown, Gift, Minus, Plus, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { formatRs, parseRupees } from "@/lib/money";
import { profitPlan, schemeFreePieces } from "../profit";
import type { Scheme } from "../schemas";

/**
 * "What will I earn?" for one product: the dukandar's selling price (MRP to start) and how
 * many pieces, against the trade price they pay. A buy-X-get-Y scheme's free pieces count.
 */
export function ProfitCalculator({
  costPaisa,
  mrpPaisa,
  startPieces,
  scheme,
}: {
  costPaisa: number;
  mrpPaisa: number;
  startPieces: number;
  scheme: Scheme | null;
}) {
  const t = useTranslations("ordering.profitCalc");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [sell, setSell] = useState<string | null>(null);
  const [pieces, setPieces] = useState(Math.max(1, startPieces));
  const sellPaisa = sell === null ? mrpPaisa : parseRupees(sell);
  const free = scheme?.kind === "buy_x_get_y" ? schemeFreePieces(scheme.rules, pieces) : 0;
  const plan =
    sellPaisa === null ? null : profitPlan({ costPaisa, sellPaisa, pieces, freePieces: free });
  const step = (delta: number) => setPieces((p) => Math.min(100_000, Math.max(1, p + delta)));

  return (
    <section className="mt-4 rounded-lg border border-border/70 bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-start"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
          <Calculator aria-hidden className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">{t("title")}</span>
          <span className="block text-sm text-muted">{t("hint")}</span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn("size-5 text-muted transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div id={`${id}-panel`} className="flex flex-col gap-4 border-t border-border/70 p-4">
          <p className="num flex items-center justify-between text-sm">
            <span className="text-muted">{t("buyAt")}</span>
            <span className="font-semibold text-ink">
              {t("perPieceShort", { price: formatRs(costPaisa) })}
            </span>
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-sell`} className="text-sm font-semibold text-ink">
                {t("sellAt")}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                  {"Rs"}
                </span>
                <input
                  id={`${id}-sell`}
                  inputMode="decimal"
                  dir="ltr"
                  value={sell ?? String(mrpPaisa / 100)}
                  onChange={(event) => setSell(event.target.value)}
                  aria-invalid={sellPaisa === null}
                  className="num h-12 w-full rounded-md border border-border bg-surface ps-10 pe-3 text-base text-ink outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring aria-invalid:border-danger"
                />
              </div>
              {sell !== null ? (
                <button
                  type="button"
                  onClick={() => setSell(null)}
                  className="self-start text-xs font-semibold text-primary-strong"
                >
                  {t("useMrp")}
                </button>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <span id={`${id}-pieces`} className="text-sm font-semibold text-ink">
                {t("pieces")}
              </span>
              <div
                role="group"
                aria-labelledby={`${id}-pieces`}
                dir="ltr"
                className="flex h-12 items-center justify-between rounded-full bg-subtle p-1"
              >
                <button
                  type="button"
                  aria-label={t("less")}
                  onClick={() => step(-1)}
                  disabled={pieces <= 1}
                  className="flex size-10 items-center justify-center rounded-full bg-surface text-ink shadow-card disabled:opacity-40"
                >
                  <Minus aria-hidden className="size-4" />
                </button>
                <span className="num text-base font-bold text-ink" aria-live="polite">
                  {pieces}
                </span>
                <button
                  type="button"
                  aria-label={t("more")}
                  onClick={() => step(1)}
                  className="flex size-10 items-center justify-center rounded-full bg-surface text-ink shadow-card"
                >
                  <Plus aria-hidden className="size-4" />
                </button>
              </div>
              {free > 0 ? (
                <span className="num flex items-center gap-1 text-xs font-bold text-primary-strong">
                  <Gift aria-hidden className="size-3.5" />
                  {t("freePieces", { count: free })}
                </span>
              ) : null}
            </div>
          </div>

          {plan ? (
            <div aria-live="polite" className="flex flex-col gap-2">
              <dl className="num grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-subtle p-3">
                  <dt className="text-muted">{t("cost")}</dt>
                  <dd className="font-semibold text-ink">{formatRs(plan.cost)}</dd>
                </div>
                <div className="rounded-md bg-subtle p-3">
                  <dt className="text-muted">{t("revenue")}</dt>
                  <dd className="font-semibold text-ink">{formatRs(plan.revenue)}</dd>
                </div>
              </dl>
              <div
                className={cn(
                  "rounded-md p-3",
                  plan.profit >= 0 ? "bg-primary-soft" : "bg-danger-soft",
                )}
              >
                <p
                  className={cn(
                    "text-sm",
                    plan.profit >= 0 ? "text-primary-strong" : "text-danger-ink",
                  )}
                >
                  {t("profit")}
                </p>
                <p
                  className={cn(
                    "num font-heading text-2xl font-extrabold",
                    plan.profit >= 0 ? "text-primary-strong" : "text-danger-ink",
                  )}
                >
                  {formatRs(plan.profit)}
                </p>
                {plan.profit >= 0 ? (
                  <p className="num text-xs font-semibold text-primary-strong">
                    {t("perPiece", {
                      amount: formatRs(plan.perPiece),
                      percent: plan.marginPercent,
                    })}
                  </p>
                ) : (
                  <p className="flex items-center gap-1 text-xs font-semibold text-danger-ink">
                    <TriangleAlert aria-hidden className="size-3.5" />
                    {t("loss")}
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
