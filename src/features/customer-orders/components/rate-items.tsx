"use client";

import { cn } from "cn";
import { Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ProductImage } from "@/components/commerce/product-image";
import { storageUrl } from "@/features/ordering/images";
import { haptic } from "@/lib/haptics";
import { rateOrderItems } from "../actions";
import type { CustomerOrderItem } from "../schemas";

/**
 * Stars for each thing in a delivered order. A tap is the whole action: the stars fill at
 * once and are saved behind it (and put back if saving fails). These are the stars other
 * shoppers see on the product.
 */
export function RateItems({
  orderId,
  items,
  current,
}: {
  orderId: string;
  items: CustomerOrderItem[];
  current: Record<string, number>;
}) {
  const t = useTranslations("customerOrders.rateItems");
  const tErrors = useTranslations("customerOrders.errors");
  const locale = useLocale();
  const [ratings, setRatings] = useState(current);
  if (items.length === 0) return null;

  const rate = async (itemId: string, rating: number) => {
    const before = ratings[itemId];
    if (before === rating) return;
    haptic("tap");
    setRatings((all) => ({ ...all, [itemId]: rating }));
    const result = await rateOrderItems(orderId, [{ itemId, rating }]);
    if (result.ok) {
      toast.success(t("saved"), { id: "rate-items" });
      return;
    }
    // Put the stars back as they were.
    setRatings((all) => {
      const next = { ...all };
      if (before === undefined) delete next[itemId];
      else next[itemId] = before;
      return next;
    });
    toast.error(tErrors(result.error));
  };

  return (
    <section className="flex flex-col gap-1 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
      <h2 className="font-heading text-lg font-bold text-ink">{t("title")}</h2>
      <p className="text-sm text-muted">{t("hint")}</p>
      <ul className="mt-2 flex flex-col divide-y divide-border/60">
        {items.map((item) => {
          const name = locale === "ur" && item.name_ur ? item.name_ur : item.name;
          const mine = ratings[item.id] ?? 0;
          return (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <ProductImage
                src={storageUrl(item.image_path)}
                alt={name}
                sizes="48px"
                className="size-12 shrink-0 rounded-xl border border-border/60"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">
                  <bdi>{name}</bdi>
                </p>
                <div role="radiogroup" aria-label={name} className="-ms-2.5 flex">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={mine === value}
                      aria-label={t("starsFor", { count: value, name })}
                      onClick={() => rate(item.id, value)}
                      className="flex size-12 items-center justify-center rounded-full transition-transform duration-150 ease-out active:scale-90 motion-reduce:transition-none"
                    >
                      <Star
                        aria-hidden
                        className={cn(
                          "size-7 transition-colors duration-150",
                          value <= mine ? "fill-awning text-awning" : "text-border-strong",
                        )}
                        strokeWidth={1.75}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
