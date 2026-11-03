"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { ProductCard } from "@/components/commerce/product-card";
import { storageUrl } from "@/features/ordering/images";
import { haptic } from "@/lib/haptics";
import { useCustomerCart, useLineQuantity } from "../cart-store";
import type { StorefrontProduct } from "../schemas";
import { ProductDetailSheet } from "./product-detail-sheet";

function GridItem({
  product,
  showShop,
  priority,
  onOpen,
}: {
  product: StorefrontProduct;
  showShop: boolean;
  priority: boolean;
  onOpen: () => void;
}) {
  const t = useTranslations("storefront");
  const locale = useLocale();
  const quantity = useLineQuantity(product.id);
  const setQuantity = useCustomerCart((state) => state.setQuantity);
  const name = locale === "ur" && product.name_ur ? product.name_ur : product.name;
  const price = product.selling_price_paisa;

  return (
    <ProductCard
      product={{
        id: product.id,
        name,
        packSize: product.pack_size_label ?? "",
        imageUrl: storageUrl(product.image_path),
        units: [
          {
            id: product.id,
            label: product.pack_size_label ?? "",
            baseQty: 1,
            pricePaisa: price,
            // Below MRP shows as a "% off" deal for shoppers.
            regularPricePaisa:
              product.mrp_paisa && product.mrp_paisa > price ? product.mrp_paisa : null,
            mrpPaisa: Math.max(product.mrp_paisa ?? price, price),
          },
        ],
        // The selling price is the shopper's price, so no dukandar margin badge.
        sellingPricePerPiecePaisa: price,
        inStock: product.in_stock,
        schemeLabel: product.low_stock ? t("lowStock") : null,
        etaLabel: showShop ? product.shop_name : null,
      }}
      unitId={product.id}
      onUnitChange={() => undefined}
      quantity={quantity}
      onQuantityChange={(next) => {
        haptic("tap");
        setQuantity(product, next);
      }}
      priorityImage={priority}
      onOpen={onOpen}
    />
  );
}

/** Products from nearby dukans, two up on phones, with ADD and a stepper; tap for details. */
export function ProductGrid({
  products,
  showShop = true,
}: {
  products: StorefrontProduct[];
  showShop?: boolean;
}) {
  const [open, setOpen] = useState<StorefrontProduct | null>(null);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product, index) => (
          <GridItem
            key={product.id}
            product={product}
            showShop={showShop}
            priority={index < 4}
            onOpen={() => setOpen(product)}
          />
        ))}
      </div>
      {open ? (
        <ProductDetailSheet key={open.id} product={open} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}

/** The same cards in one swipeable row (Buy again, Deals). */
export function ProductRail({
  products,
  label,
  showShop = true,
}: {
  products: StorefrontProduct[];
  label: string;
  showShop?: boolean;
}) {
  const [open, setOpen] = useState<StorefrontProduct | null>(null);
  return (
    <>
      {/* relative: badges positioned inside the cards are clipped by this row too. */}
      <ul
        aria-label={label}
        className="relative -mx-4 flex snap-x scroll-px-4 [scrollbar-width:none] gap-3 overflow-x-auto px-4 pb-1"
      >
        {products.map((product) => (
          <li key={product.id} className="w-44 shrink-0 snap-start">
            <GridItem
              product={product}
              showShop={showShop}
              priority={false}
              onOpen={() => setOpen(product)}
            />
          </li>
        ))}
      </ul>
      {open ? (
        <ProductDetailSheet key={open.id} product={open} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}
