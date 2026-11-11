"use client";

import { cn } from "cn";
import { useState } from "react";
import type { StorefrontProduct } from "../schemas";
import { ProductSheet } from "./product-sheet";
import { ProductTile } from "./product-tile";

/**
 * A shelf of products: three across on a phone, with ADD on each photo; tap one for its
 * page. `openId` opens that product straight away (a link shared from the product page).
 */
export function ProductGrid({
  products,
  showShop = true,
  openId,
  onOpenProduct,
  className,
}: {
  products: StorefrontProduct[];
  showShop?: boolean;
  openId?: string;
  /** Told when a product is opened (search remembers what led to it). */
  onOpenProduct?: (product: StorefrontProduct) => void;
  className?: string;
}) {
  const [open, setOpen] = useState<StorefrontProduct | null>(
    () => products.find((product) => product.id === openId) ?? null,
  );
  return (
    <>
      <div
        className={cn(
          "grid grid-cols-3 gap-x-2.5 gap-y-5 sm:grid-cols-4 lg:grid-cols-6",
          className,
        )}
      >
        {products.map((product, index) => (
          <ProductTile
            key={product.id}
            product={product}
            showShop={showShop}
            priority={index < 6}
            onOpen={() => {
              onOpenProduct?.(product);
              setOpen(product);
            }}
          />
        ))}
      </div>
      {open ? <ProductSheet key={open.id} product={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

/** The same tiles in one swipeable row (Buy again, Deals, a category's shelf). */
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
      {/* relative: the tiles' stretched tap areas are clipped by this row too. */}
      <ul
        aria-label={label}
        className="relative -mx-4 flex snap-x scroll-px-4 [scrollbar-width:none] gap-2.5 overflow-x-auto px-4 pb-1"
      >
        {products.map((product) => (
          <li key={product.id} className="w-[29vw] max-w-32 min-w-26 shrink-0 snap-start">
            <ProductTile product={product} showShop={showShop} onOpen={() => setOpen(product)} />
          </li>
        ))}
      </ul>
      {open ? <ProductSheet key={open.id} product={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
