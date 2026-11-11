"use client";

import { cn } from "cn";
import { Clock3, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { AddToCart } from "@/components/commerce/add-to-cart";
import { ProductImage } from "@/components/commerce/product-image";
import { categoryIcon } from "@/features/ordering/category-style";
import { storageUrl } from "@/features/ordering/images";
import { haptic } from "@/lib/haptics";
import { discountPercent, formatRs } from "@/lib/money";
import { useCustomerCart, useLineQuantity } from "../cart-store";
import type { StorefrontProduct } from "../schemas";

/** "4.6 (12)" with one filled star; nothing at all until somebody has rated the product. */
export function ProductStars({
  rating,
  count,
  className,
}: {
  rating: number | null | undefined;
  count: number | undefined;
  className?: string;
}) {
  const t = useTranslations("storefront.rating");
  if (!rating || !count) return null;
  return (
    <p className={cn("num flex items-center gap-1 text-xs font-semibold text-ink", className)}>
      <Star aria-hidden className="size-3.5 fill-awning text-awning" strokeWidth={1.75} />
      <span aria-hidden>{rating.toFixed(1)}</span>
      <span aria-hidden className="font-medium text-muted">
        {t("count", { count })}
      </span>
      {/* Read aloud as one sentence instead of "4.6" and "(12)". */}
      <span className="sr-only">{t("productLabel", { rating: rating.toFixed(1), count })}</span>
    </p>
  );
}

/**
 * A product the way a shelf shows it: the photo first, ADD on its corner, then size, price
 * and name. Three fit across a phone, so a shopper sees a whole shelf at once. Tapping the
 * tile opens the product; a product with several sizes asks which one before adding.
 */
export function ProductTile({
  product,
  showShop = false,
  priority = false,
  onOpen,
}: {
  product: StorefrontProduct;
  /** Name the dukan under the product (lists that mix dukans). */
  showShop?: boolean;
  priority?: boolean;
  onOpen: () => void;
}) {
  const t = useTranslations("storefront");
  const tProduct = useTranslations("product");
  const locale = useLocale();
  const quantity = useLineQuantity(product.id);
  const setQuantity = useCustomerCart((state) => state.setQuantity);
  const name = locale === "ur" && product.name_ur ? product.name_ur : product.name;
  const price = product.selling_price_paisa;
  const off = product.mrp_paisa ? discountPercent(price, product.mrp_paisa) : 0;
  const sizes = product.sizes ?? 1;
  // Which size? The product page lists them, each with its own ADD.
  const askSize = sizes > 1 && quantity === 0;

  return (
    <article
      data-slot="product-tile"
      aria-label={name}
      className="group relative flex min-w-0 flex-col"
    >
      <div className="relative">
        <ProductImage
          src={storageUrl(product.image_path)}
          alt={name}
          priority={priority}
          sizes="(min-width: 1024px) 180px, (min-width: 640px) 22vw, 31vw"
          fallbackCaption={product.brand_name ?? undefined}
          fallbackIcon={product.category_slug ? categoryIcon(product.category_slug) : undefined}
          className="rounded-2xl border border-border/60 bg-surface shadow-card transition-transform duration-150 ease-out group-active:scale-[0.98] motion-reduce:transition-none"
        />
        {off > 0 ? (
          <span className="num absolute start-0 top-2.5 rounded-e-full bg-awning py-0.5 ps-2 pe-2.5 text-xs font-extrabold text-on-awning shadow-card">
            {tProduct("percentOff", { percent: off })}
          </span>
        ) : null}
        <div className="absolute end-1.5 -bottom-2 z-10">
          {askSize ? (
            <button
              type="button"
              onClick={() => {
                haptic("tap");
                onOpen();
              }}
              aria-label={t("chooseSizeNamed", { name })}
              className="relative flex h-9 w-[72px] items-center justify-center rounded-full border-[1.5px] border-primary bg-surface text-sm font-bold tracking-wide text-primary-strong shadow-card after:absolute after:inset-x-0 after:-inset-y-1.5"
            >
              {tProduct("add")}
            </button>
          ) : (
            <AddToCart
              size="sm"
              quantity={quantity}
              onQuantityChange={(next) => setQuantity(product, next)}
              productName={name}
              className="shadow-card"
            />
          )}
        </div>
      </div>

      <div className="mt-3.5 flex flex-1 flex-col gap-0.5 px-0.5">
        <p className="num truncate text-xs text-muted">
          {product.pack_size_label ?? " "}
          {sizes > 1 ? <span> · {t("sizesCount", { count: sizes })}</span> : null}
        </p>
        <p className="num flex flex-wrap items-baseline gap-x-1.5">
          <span className="font-heading text-base leading-tight font-extrabold text-ink">
            {formatRs(price)}
          </span>
          {off > 0 && product.mrp_paisa ? (
            <span className="text-xs text-muted line-through">{formatRs(product.mrp_paisa)}</span>
          ) : null}
        </p>
        <h3 className="line-clamp-3 text-sm leading-[1.3] font-medium text-pretty text-ink">
          {/* One control for details: the name, with its tap area stretched over the whole tile
              (photo included). ADD sits above it. */}
          <button
            type="button"
            onClick={onOpen}
            className="text-start after:absolute after:inset-0 after:rounded-2xl"
          >
            {name}
          </button>
        </h3>
        <ProductStars rating={product.rating} count={product.rating_count} />
        {product.low_stock ? (
          <p className="text-xs font-semibold text-awning-ink">{t("lowStock")}</p>
        ) : null}
        {showShop ? (
          // A tile is too narrow for a dukan's name beside the time: the time is what a
          // shopper compares, and the product page names the dukan (and the others selling it).
          <p className="num flex min-w-0 items-center gap-1 text-xs text-muted">
            {product.eta_minutes ? (
              <>
                <Clock3 aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{t("eta", { minutes: product.eta_minutes })}</span>
              </>
            ) : (
              <span className="truncate">{product.shop_name}</span>
            )}
          </p>
        ) : null}
      </div>
    </article>
  );
}
