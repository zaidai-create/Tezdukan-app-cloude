"use client";

import { cn } from "cn";
import { Check, ChevronDown, PackagePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ProductImage } from "@/components/commerce/product-image";
import { Button } from "@/components/ui/button";
import { storageUrl } from "@/features/ordering/images";
import { PriceField, QtyField, rupeesText } from "@/features/shop-products/components/fields";
import { haptic } from "@/lib/haptics";
import { formatRs, parseRupees } from "@/lib/money";
import { addStarterProducts } from "../actions";
import type { OrgStarterItem } from "../schemas";

// A starting trade price a little under MRP; the distributor checks each before adding.
const suggestedTrade = (mrp: number) => (mrp > 0 ? Math.round((mrp * 0.88) / 100) * 100 : 0);

/** Common products a distributor can list in one tap, with trade prices to check first. */
export function OrgStarterPack({
  items,
  defaultOpen,
}: {
  items: OrgStarterItem[];
  defaultOpen: boolean;
}) {
  const t = useTranslations("catalog.starter");
  const tErrors = useTranslations("catalog.form.errors");
  const [open, setOpen] = useState(defaultOpen);
  const [selected, setSelected] = useState(
    () => new Set(items.filter((item) => item.mrp_paisa > 0).map((item) => item.id)),
  );
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.id, rupeesText(suggestedTrade(item.mrp_paisa))])),
  );
  const [stockEach, setStockEach] = useState(0);
  const [pending, startTransition] = useTransition();

  const chosen = items.filter((item) => selected.has(item.id));
  const priceOf = (item: OrgStarterItem) => parseRupees(prices[item.id] ?? "");
  const invalid = chosen.filter((item) => {
    const price = priceOf(item);
    return !price || (item.mrp_paisa > 0 && price > item.mrp_paisa);
  });

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
      const result = await addStarterProducts(
        chosen.map((item) => ({
          id: item.id,
          trade_price_paisa: priceOf(item) ?? 0,
          stock_in_qty: stockEach,
        })),
      );
      if (!result.ok) {
        toast.error(tErrors(result.error));
        return;
      }
      haptic("success");
      toast.success(t("added", { count: result.data.added }));
      setOpen(false);
    });

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-primary/25 bg-primary-soft/60 p-4 shadow-card">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex items-start gap-3 text-start"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-surface text-primary-strong shadow-card">
          <PackagePlus aria-hidden className="size-6" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-lg font-bold text-ink">{t("title")}</span>
          <span className="block text-sm text-muted">{t("hint", { count: items.length })}</span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "mt-2 size-5 shrink-0 text-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface p-3">
            <span className="text-sm font-semibold text-ink">{t("stockEach")}</span>
            <QtyField value={stockEach} onChange={setStockEach} label={t("stockEach")} step={12} />
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((item) => {
              const on = selected.has(item.id);
              const price = priceOf(item);
              const bad = on && (!price || (item.mrp_paisa > 0 && price > item.mrp_paisa));
              return (
                <li
                  key={item.id}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border bg-surface p-2.5 shadow-card",
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
                  <span className="num text-xs text-muted">
                    {item.mrp_paisa > 0 ? t("mrp", { price: formatRs(item.mrp_paisa) }) : null}
                  </span>
                  <PriceField
                    value={prices[item.id] ?? ""}
                    onChange={(value) => setPrices((current) => ({ ...current, [item.id]: value }))}
                    label={t("tradeFor", { name: item.name })}
                    invalid={bad}
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
            {invalid.length > 0 ? t("fixPrices") : t("add", { count: chosen.length })}
          </Button>
        </>
      ) : null}
    </section>
  );
}
