"use client";

import { cn } from "cn";
import { PackageSearch } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { EmptyState } from "@/components/states/empty-state";
import type { StorefrontProduct } from "../schemas";
import { ProductGrid } from "./product-grid";

/**
 * One dukan's products with its own aisle chips: "All" and each category the dukan stocks.
 * Filtering happens on the phone, so switching aisles is instant.
 */
export function ShopShelf({
  products,
  categories,
  openId,
}: {
  products: StorefrontProduct[];
  /** Categories this dukan has products in, already named in the shopper's language. */
  categories: { id: string; name: string }[];
  openId?: string;
}) {
  const t = useTranslations("storefront");
  const [aisle, setAisle] = useState<string | null>(null);
  const shown = aisle ? products.filter((product) => product.category_id === aisle) : products;
  const chip = (active: boolean) =>
    cn(
      "relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors after:absolute after:inset-x-0 after:-inset-y-1",
      active
        ? "border-primary bg-primary-soft text-primary-strong"
        : "border-border bg-surface text-ink",
    );
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-lg font-bold text-ink lg:text-xl">{t("shop.products")}</h2>
      {categories.length > 1 ? (
        <div
          role="group"
          aria-label={t("categories.title")}
          className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1"
        >
          <button
            type="button"
            aria-pressed={aisle === null}
            onClick={() => setAisle(null)}
            className={chip(aisle === null)}
          >
            {t("categories.all")}
            <span className="num text-xs opacity-70">{products.length}</span>
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-pressed={aisle === category.id}
              onClick={() => setAisle(category.id)}
              className={chip(aisle === category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>
      ) : null}
      {shown.length > 0 ? (
        <ProductGrid products={shown} showShop={false} openId={openId} />
      ) : (
        <EmptyState icon={PackageSearch} title={t("categories.empty")} awning={false} />
      )}
    </section>
  );
}
