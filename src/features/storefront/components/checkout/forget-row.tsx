"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { AddToCart } from "@/components/commerce/add-to-cart";
import { ProductImage } from "@/components/commerce/product-image";
import { Skeleton } from "@/components/ui/skeleton";
import { storageUrl } from "@/features/ordering/images";
import { formatRs } from "@/lib/money";
import { useCustomerCart, useLineQuantity } from "../../cart-store";
import { useShopProducts } from "../../queries";
import type { StorefrontProduct } from "../../schemas";
import type { CartGroup } from "./bill";

/**
 * "Did you forget?": a short row of the same dukan's everyday items that are not in the cart.
 * It helps the shopper (one order, one delivery) and the dukan (a bigger basket); the dukan's
 * own picks come first, then items on offer, then the cheaper ones. Hidden when there is nothing
 * to suggest; never blocks checkout.
 */
export function ForgetRow({ group }: { group: CartGroup }) {
  const t = useTranslations("storefront.cart.forget");
  const { data, isPending } = useShopProducts(group.shopSlug);
  // What was in the cart when checkout opened: an item added from this row stays in it (now
  // with its stepper) instead of jumping away.
  const [inCart] = useState(() => new Set(group.lines.map((line) => line.id)));

  if (isPending) {
    return (
      <div aria-hidden className="flex gap-3 overflow-hidden">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-48 w-36 shrink-0 rounded-[18px]" />
        ))}
      </div>
    );
  }
  const picks = rank((data ?? []).filter((product) => !inCart.has(product.id))).slice(0, 10);
  if (picks.length === 0) return null;

  return (
    <section aria-labelledby={`forget-${group.shopId}`} className="flex flex-col gap-2.5">
      <h2 id={`forget-${group.shopId}`} className="font-heading text-lg font-bold text-ink">
        {t("title")}
      </h2>
      <ul className="-mx-4 flex snap-x [scrollbar-width:none] gap-3 overflow-x-auto px-4 pb-1">
        {picks.map((product) => (
          <li key={product.id} className="w-36 shrink-0 snap-start">
            <ForgetCard product={product} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function rank(products: StorefrontProduct[]): StorefrontProduct[] {
  const offer = (product: StorefrontProduct) =>
    product.mrp_paisa && product.mrp_paisa > product.selling_price_paisa ? 1 : 0;
  return [...products].sort(
    (a, b) =>
      Number(b.is_favourite) - Number(a.is_favourite) ||
      offer(b) - offer(a) ||
      a.selling_price_paisa - b.selling_price_paisa,
  );
}

function ForgetCard({ product }: { product: StorefrontProduct }) {
  const locale = useLocale();
  const quantity = useLineQuantity(product.id);
  const setQuantity = useCustomerCart((state) => state.setQuantity);
  const name = locale === "ur" && product.name_ur ? product.name_ur : product.name;
  return (
    <article className="flex h-full flex-col gap-2 rounded-[18px] border border-border/60 bg-surface p-2 shadow-card">
      <ProductImage
        src={storageUrl(product.image_path)}
        alt={name}
        sizes="128px"
        className="aspect-square w-full rounded-xl"
      />
      <p className="line-clamp-2 min-h-10 text-sm leading-5 font-semibold text-ink">
        <bdi>{name}</bdi>
      </p>
      <div className="mt-auto flex items-center justify-between gap-1">
        <span className="num text-sm font-bold text-ink">
          {formatRs(product.selling_price_paisa)}
        </span>
        <AddToCart
          size="sm"
          quantity={quantity}
          onQuantityChange={(next) => setQuantity(product, next)}
          productName={name}
        />
      </div>
    </article>
  );
}
