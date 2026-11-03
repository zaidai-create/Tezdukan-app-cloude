"use client";

import { cn } from "cn";
import { Check, PackagePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ProductImage } from "@/components/commerce/product-image";
import { Button } from "@/components/ui/button";
import { storageUrl } from "@/features/ordering/images";
import { haptic } from "@/lib/haptics";
import { parseRupees } from "@/lib/money";
import { addProducts } from "../actions";
import type { StarterItem } from "../schemas";
import { PriceField, QtyField, rupeesText } from "./fields";

/**
 * The common products most dukans stock, ready to add in one tap: all ticked, priced at MRP,
 * with the same opening stock each. Untick or change a price before adding.
 */
export function StarterPack({ items, onDone }: { items: StarterItem[]; onDone?: () => void }) {
  const t = useTranslations("shopProducts");
  const [selected, setSelected] = useState(
    () => new Set(items.filter((item) => item.mrp_paisa > 0).map((item) => item.id)),
  );
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.id, rupeesText(item.mrp_paisa)])),
  );
  const [stockEach, setStockEach] = useState(10);
  const [pending, startTransition] = useTransition();

  const chosen = items.filter((item) => selected.has(item.id));
  const invalid = chosen.filter((item) => !parseRupees(prices[item.id] ?? ""));

  const toggle = (id: string) => {
    haptic("tap");
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const add = () =>
    startTransition(async () => {
      const result = await addProducts(
        chosen.map((item) => ({
          master_product_id: item.id,
          selling_price_paisa: parseRupees(prices[item.id] ?? "") ?? 0,
          qty: stockEach,
        })),
      );
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      haptic("success");
      toast.success(t("added", { count: result.data.added + result.data.updated }));
      onDone?.();
    });

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-primary/25 bg-primary-soft/60 p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-surface text-primary-strong shadow-card">
          <PackagePlus aria-hidden className="size-6" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-bold text-ink">{t("starter.title")}</h2>
          <p className="text-sm text-muted">{t("starter.hint")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface p-3">
        <span className="text-sm font-semibold text-ink">{t("starter.stockEach")}</span>
        <QtyField
          value={stockEach}
          onChange={setStockEach}
          label={t("starter.stockEach")}
          step={5}
        />
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => {
          const on = selected.has(item.id);
          return (
            <li
              key={item.id}
              className={cn(
                "flex flex-col gap-2 rounded-lg border bg-surface p-2.5 shadow-card transition-[border-color,opacity] duration-150",
                on ? "border-primary" : "border-border/70 opacity-70",
              )}
            >
              <label className="relative flex cursor-pointer flex-col gap-2">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={on}
                  onChange={() => toggle(item.id)}
                />
                <ProductImage
                  src={storageUrl(item.image_path)}
                  alt={item.name}
                  sizes="160px"
                  className="aspect-square w-full rounded-md"
                />
                <span
                  aria-hidden
                  className={cn(
                    "absolute end-1.5 top-1.5 flex size-7 items-center justify-center rounded-full border-2 shadow-card peer-focus-visible:ring-3 peer-focus-visible:ring-ring",
                    on
                      ? "border-action bg-action text-on-action"
                      : "border-border-strong bg-surface",
                  )}
                >
                  {on ? <Check className="size-4" strokeWidth={2.5} /> : null}
                </span>
                <span className="line-clamp-2 min-h-10 text-sm leading-tight font-semibold text-ink">
                  {item.name}
                </span>
              </label>
              <PriceField
                value={prices[item.id] ?? ""}
                onChange={(value) => setPrices((current) => ({ ...current, [item.id]: value }))}
                label={t("priceFor", { name: item.name })}
                invalid={on && !parseRupees(prices[item.id] ?? "")}
                className="h-11"
              />
            </li>
          );
        })}
      </ul>

      <Button
        size="lg"
        block
        loading={pending}
        disabled={chosen.length === 0 || invalid.length > 0}
        onClick={add}
      >
        <PackagePlus aria-hidden />
        {invalid.length > 0 ? t("starter.fixPrices") : t("starter.add", { count: chosen.length })}
      </Button>
    </section>
  );
}
