"use client";

import { cn } from "cn";
import { BadgePercent, PackageX } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { AddToCart } from "@/components/commerce/add-to-cart";
import { ProductImage } from "@/components/commerce/product-image";
import { formatRs } from "@/lib/money";
import { categoryIcon } from "../category-style";
import { storageUrl } from "../images";
import { defaultUnit, localName, margin, schemeLabel, unitName } from "../labels";
import { quantityIn, useCart, useProductSheet, useSetCartItem } from "../queries";
import type { CatalogItem } from "../schemas";

type CatalogCardProps = {
  item: CatalogItem;
  shopId: string;
  /** Grid cards stretch; rail cards have a fixed width for horizontal scrolling. */
  layout?: "grid" | "rail";
  priorityImage?: boolean;
  className?: string;
};

/**
 * A product as the dukandar buys it: photo, scheme, price per pack with the per-piece price,
 * profit at MRP, pack-size switch and the ADD stepper (wired to the server cart).
 */
function CatalogCard({
  item,
  shopId,
  layout = "grid",
  priorityImage = false,
  className,
}: CatalogCardProps) {
  const t = useTranslations("ordering");
  const locale = useLocale();
  const { data: cart } = useCart(shopId);
  const setCartItem = useSetCartItem(shopId);
  const openSheet = useProductSheet((s) => s.open);
  const [unitId, setUnitId] = useState(() => defaultUnit(item)?.id ?? "");
  const unit = item.pack_units.find((u) => u.id === unitId) ?? defaultUnit(item);
  if (!unit) return null;

  const name = localName(item, locale);
  const quantity = quantityIn(cart, item.distributor_product_id, unit.id);
  const profit = margin(item);
  const minUnits = Math.max(1, Math.ceil(item.moq_base_qty / unit.base_qty));

  return (
    <article
      data-slot="catalog-card"
      aria-label={name}
      className={cn(
        "flex flex-col rounded-lg border border-border/70 bg-surface p-2 shadow-card",
        layout === "rail" && "w-[164px] shrink-0 snap-start",
        className,
      )}
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => openSheet(item.distributor_product_id)}
          className="block w-full rounded-md"
          // The name below is the same control for keyboards and screen readers.
          tabIndex={-1}
          aria-hidden
        >
          <ProductImage
            src={storageUrl(item.image_path)}
            alt={name}
            fallbackIcon={categoryIcon(item.category_slug ?? "")}
            fallbackCaption={item.brand_name ?? undefined}
            priority={priorityImage}
            sizes={layout === "rail" ? "164px" : "(min-width: 1024px) 220px, 46vw"}
            className={cn("rounded-md", !item.in_stock && "opacity-60 grayscale")}
          />
        </button>
        {item.scheme ? (
          <span className="pointer-events-none absolute start-1.5 top-1.5 inline-flex max-w-[calc(100%-12px)] items-center gap-1 rounded-sm bg-awning px-1.5 py-0.5 text-xs font-bold text-on-awning shadow-card">
            <BadgePercent aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{schemeLabel(t, item.scheme)}</span>
          </span>
        ) : null}
        {!item.in_stock ? (
          <span className="pointer-events-none absolute end-1.5 bottom-1.5 inline-flex items-center gap-1 rounded-sm bg-danger-soft px-1.5 py-0.5 text-xs font-bold text-danger-ink">
            <PackageX aria-hidden className="size-3.5" />
            {t("outOfStock")}
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-1 flex-col gap-0.5 px-0.5">
        <p className="truncate text-xs text-muted">{item.org_name}</p>
        <h3 className="min-h-10 text-sm leading-5 font-semibold text-ink">
          <button
            type="button"
            onClick={() => openSheet(item.distributor_product_id)}
            className="line-clamp-2 text-start"
          >
            {name}
          </button>
        </h3>
        <p dir="ltr" className="num flex items-baseline gap-1.5 rtl:justify-end">
          <span className="font-heading text-base font-extrabold text-ink">
            {formatRs(item.price_paisa * unit.base_qty)}
          </span>
          {item.mrp_paisa > item.price_paisa ? (
            <s className="text-xs text-muted">{formatRs(item.mrp_paisa * unit.base_qty)}</s>
          ) : null}
        </p>
        <p className="num text-xs text-muted">
          {unit.base_qty > 1
            ? t("perPiece", { price: formatRs(item.price_paisa) })
            : unitName(t, unit)}
        </p>
        {profit.perPiece > 0 ? (
          <p className="num mt-0.5 text-xs font-semibold text-primary-strong">
            {t("profit", { amount: formatRs(profit.perPiece) })}
          </p>
        ) : null}
      </div>

      {item.pack_units.length > 1 ? (
        <div
          role="radiogroup"
          aria-label={t("packSize")}
          className="mt-2 flex gap-1 rounded-full bg-subtle p-0.5"
        >
          {item.pack_units.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={option.id === unit.id}
              onClick={() => setUnitId(option.id)}
              className={cn(
                "num relative h-8 min-w-0 flex-1 truncate rounded-full px-1.5 text-xs font-semibold transition-colors after:absolute after:inset-x-0 after:-inset-y-1",
                option.id === unit.id ? "bg-surface text-ink shadow-card" : "text-muted",
              )}
            >
              {option.base_qty > 1 ? t("pieces", { count: option.base_qty }) : t("unitPiece")}
            </button>
          ))}
        </div>
      ) : null}

      <AddToCart
        className="mt-2 w-full"
        quantity={quantity}
        productName={name}
        minQuantity={minUnits}
        disabled={!item.in_stock && quantity === 0}
        onQuantityChange={(next) =>
          setCartItem({
            productId: item.distributor_product_id,
            unitId: unit.id,
            quantity: next,
            previous: quantity,
            name,
            add: { item, unit },
          })
        }
      />
    </article>
  );
}

export { CatalogCard };
