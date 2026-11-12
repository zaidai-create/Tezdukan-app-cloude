import { ArrowRight, Repeat, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { formatRs } from "@/lib/money";
import type { OrderChange } from "../schemas";

/** What the dukan changed because something was not on the shelf: removed or replaced lines. */
export function OrderChanges({ changes }: { changes: OrderChange[] }) {
  const t = useTranslations("customerOrders.unavailable");
  const locale = useLocale();
  if (changes.length === 0) return null;
  const pick = (english: string, urdu: string | null) => (locale === "ur" && urdu ? urdu : english);
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-awning/40 bg-awning-soft p-4">
      <h2 className="font-heading text-base font-bold text-ink">{t("changesTitle")}</h2>
      <ul className="flex flex-col gap-2">
        {changes.map((change) => (
          <li key={change.id} className="flex items-start gap-2.5 text-sm text-ink">
            {change.kind === "removed" ? (
              <Trash2
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-awning-ink"
                strokeWidth={1.75}
              />
            ) : (
              <Repeat
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-awning-ink"
                strokeWidth={1.75}
              />
            )}
            {change.kind === "removed" ? (
              <span>
                <bdi className="line-through">{pick(change.item_name, change.item_name_ur)}</bdi>{" "}
                <span className="text-muted">
                  {t("removedLine", { amount: formatRs(change.line_total_paisa) })}
                </span>
              </span>
            ) : (
              <span className="flex flex-wrap items-center gap-x-1.5">
                <bdi className="line-through">{pick(change.item_name, change.item_name_ur)}</bdi>
                <ArrowRight aria-hidden className="size-3.5 rtl:-scale-x-100" />
                <bdi className="font-semibold">
                  {pick(change.new_name ?? "", change.new_name_ur)}
                </bdi>
                <span className="num text-muted">
                  {`${formatRs(change.line_total_paisa)} → ${formatRs(change.new_line_total_paisa ?? 0)}`}
                </span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
