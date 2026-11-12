"use client";

import { BadgePercent, ReceiptText, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { formatRs } from "@/lib/money";
import type { Bill } from "./bill";

/**
 * "Bill details", said the way the big apps do: what the items cost (printed price struck
 * through), delivery (free struck through when waived), the total, and one line of savings.
 * No hidden fees: what is here is what the rider collects.
 */
export function BillCard({
  bill,
  shopName,
  action,
  id,
}: {
  bill: Bill;
  /** Named when the cart has several dukans, each with its own bill. */
  shopName?: string;
  /** The place button, when the cart has several dukans. */
  action?: ReactNode;
  id?: string;
}) {
  const t = useTranslations("storefront.cart");
  const locale = useLocale();
  return (
    <section
      id={id}
      tabIndex={-1}
      aria-labelledby={id ? `${id}-title` : undefined}
      className="flex scroll-mt-24 flex-col gap-3 rounded-lg border border-border/60 bg-surface p-4 shadow-card outline-none"
    >
      <h2
        id={id ? `${id}-title` : undefined}
        className="flex items-center gap-2 font-heading text-lg font-bold text-ink"
      >
        <ReceiptText aria-hidden className="size-5 text-primary" strokeWidth={1.75} />
        {shopName ? t("bill.titleFor", { shop: shopName }) : t("bill.title")}
      </h2>
      <dl className="num flex flex-col gap-2 text-base" dir={locale === "ur" ? "rtl" : undefined}>
        <BillRow label={t("itemTotal")}>
          {bill.mrpTotal > bill.itemTotal ? (
            <span className="me-1.5 text-sm text-muted line-through">
              {formatRs(bill.mrpTotal)}
            </span>
          ) : null}
          {formatRs(bill.itemTotal)}
        </BillRow>
        <BillRow label={t("delivery")}>
          {bill.fee === 0 && bill.usualFee > 0 ? (
            <span className="me-1.5 text-sm text-muted line-through">
              {formatRs(bill.usualFee)}
            </span>
          ) : null}
          {bill.fee === 0 ? (
            <span className="font-semibold text-primary-strong">{t("free")}</span>
          ) : (
            formatRs(bill.fee)
          )}
        </BillRow>
        <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-border-strong/60 pt-2.5 font-heading text-lg font-bold">
          <dt className="text-ink">{t("toPay")}</dt>
          <dd className="text-ink">{formatRs(bill.total)}</dd>
        </div>
      </dl>
      {bill.savings > 0 ? (
        <p className="num flex items-center gap-2 rounded-md bg-primary-soft px-3 py-2.5 text-sm font-semibold text-primary-strong">
          <BadgePercent aria-hidden className="size-5 shrink-0" strokeWidth={1.75} />
          {t("savings", { amount: formatRs(bill.savings) })}
        </p>
      ) : null}
      {action}
    </section>
  );
}

function BillRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

/**
 * The cancellation rule, before the order goes: fair to the dukan (no cancelling once it has
 * packed) and clear for the shopper (free until it is accepted, a short window after).
 */
export function CancellationPolicy() {
  const t = useTranslations("storefront.cart.policy");
  return (
    <section className="flex gap-3 rounded-lg bg-subtle/70 p-4">
      <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-muted" strokeWidth={1.75} />
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-base font-bold text-ink">{t("title")}</h2>
        <ul className="flex list-disc flex-col gap-0.5 ps-4 text-sm text-muted marker:text-border-strong">
          <li>{t("free")}</li>
          <li>{t("grace")}</li>
          <li>{t("packed")}</li>
        </ul>
      </div>
    </section>
  );
}
