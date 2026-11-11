"use client";

import { cn } from "cn";
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  Share2,
  ShieldCheck,
  Star,
  Store,
  Tag,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AddToCart } from "@/components/commerce/add-to-cart";
import { ProductImage } from "@/components/commerce/product-image";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { storageUrl } from "@/features/ordering/images";
import { Link } from "@/i18n/navigation";
import { haptic } from "@/lib/haptics";
import { discountPercent, formatRs } from "@/lib/money";
import { useCustomerCart, useLineQuantity } from "../cart-store";
import { useProductDetail } from "../queries";
import type { ProductDetail, StorefrontProduct } from "../schemas";
import { ProductStars, ProductTile } from "./product-tile";

const card = "rounded-2xl border border-border/50 bg-surface p-4 shadow-card";

/** Photos side by side; swipe to see the next. One photo shows no dots. */
function Gallery({ images, name, brand }: { images: string[]; name: string; brand?: string }) {
  const t = useTranslations("storefront.product");
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const photos = images.length > 0 ? images : [null];
  return (
    <div className="relative bg-surface">
      <div
        ref={track}
        dir="ltr"
        className="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto"
        onScroll={(event) => {
          const element = event.currentTarget;
          setIndex(Math.round(element.scrollLeft / Math.max(element.clientWidth, 1)));
        }}
      >
        {photos.map((path, position) => (
          <div key={path ?? "none"} className="w-full shrink-0 snap-center px-10 pt-12 pb-6">
            <ProductImage
              src={path ? storageUrl(path) : null}
              alt={photos.length > 1 ? t("photoOf", { name, index: position + 1 }) : name}
              sizes="(min-width: 640px) 420px, 80vw"
              priority={position === 0}
              surface="none"
              fallbackCaption={brand}
              className="aspect-auto h-[36dvh] max-h-80 w-full rounded-2xl"
            />
          </div>
        ))}
      </div>
      {photos.length > 1 ? (
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5" aria-hidden>
          {photos.map((path, position) => (
            <span
              key={path ?? position}
              className={cn(
                "h-1.5 rounded-full transition-all duration-200",
                position === index ? "w-5 bg-ink" : "w-1.5 bg-border-strong/50",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A short fact about the product: what it is called above, the answer below. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-28 shrink-0 rounded-xl border border-border/50 bg-surface px-3 py-2 shadow-card">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function SizePicker({
  sizes,
  current,
  onPick,
}: {
  sizes: StorefrontProduct[];
  current: StorefrontProduct;
  onPick: (product: StorefrontProduct) => void;
}) {
  const t = useTranslations("storefront.product");
  const tProduct = useTranslations("product");
  return (
    <div className="mt-4 flex flex-col gap-2">
      <p className="text-sm font-semibold text-ink">{t("chooseSize")}</p>
      <div role="radiogroup" aria-label={t("chooseSize")} className="flex flex-wrap gap-2">
        {sizes.map((size) => {
          const on = size.id === current.id;
          const off = size.mrp_paisa
            ? discountPercent(size.selling_price_paisa, size.mrp_paisa)
            : 0;
          return (
            <button
              key={size.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                haptic("tap");
                onPick(size);
              }}
              className={cn(
                "num flex min-h-16 min-w-24 flex-col items-start justify-center rounded-xl border-[1.5px] px-3 py-2 text-start transition-colors",
                on ? "border-primary bg-primary-soft" : "border-border bg-surface",
              )}
            >
              <span className="text-sm font-semibold text-ink">
                {size.pack_size_label ?? size.name}
              </span>
              <span className="text-base font-extrabold text-ink">
                {formatRs(size.selling_price_paisa)}
              </span>
              {off > 0 ? (
                <span className="text-xs font-bold text-awning-ink">
                  {tProduct("percentOff", { percent: off })}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className="flex gap-2">
        <Skeleton className="h-14 w-28 rounded-xl" />
        <Skeleton className="h-14 w-28 rounded-xl" />
        <Skeleton className="h-14 w-28 rounded-xl" />
      </div>
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-6 w-40 rounded-md" />
      <div className="grid grid-cols-3 gap-2.5">
        <Skeleton className="aspect-square rounded-2xl" />
        <Skeleton className="aspect-square rounded-2xl" />
        <Skeleton className="aspect-square rounded-2xl" />
      </div>
    </div>
  );
}

function ShopRow({ shop, onNavigate }: { shop: ProductDetail["shop"]; onNavigate: () => void }) {
  const t = useTranslations("storefront");
  return (
    <Link
      href={`/shops/${shop.slug}`}
      onClick={onNavigate}
      className={cn(card, "flex items-center gap-3 p-3")}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
        <Store aria-hidden className="size-5" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted">{t("soldBy")}</span>
        <span className="block truncate font-semibold text-ink">{shop.name}</span>
        <span className="num flex flex-wrap items-center gap-x-2.5 text-xs text-muted">
          {shop.rating && shop.rating_count > 0 ? (
            <span className="flex items-center gap-1 font-semibold text-ink">
              <Star aria-hidden className="size-3.5 fill-awning text-awning" strokeWidth={1.75} />
              {shop.rating.toFixed(1)}
            </span>
          ) : null}
          {shop.eta_minutes ? (
            <span className="flex items-center gap-1">
              <Clock3 aria-hidden className="size-3.5" />
              {t("eta", { minutes: shop.eta_minutes })}
            </span>
          ) : null}
          <span>
            {shop.delivery_fee_paisa === 0
              ? t("freeDelivery")
              : t("deliveryFee", { amount: formatRs(shop.delivery_fee_paisa) })}
          </span>
        </span>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted rtl:-scale-x-100" />
    </Link>
  );
}

/** The same product at another dukan: its price and time, and its own ADD. */
function OfferRow({ offer }: { offer: StorefrontProduct }) {
  const t = useTranslations("storefront");
  const quantity = useLineQuantity(offer.id);
  const setQuantity = useCustomerCart((state) => state.setQuantity);
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">{offer.shop_name}</span>
        <span className="num flex items-center gap-2 text-sm text-muted">
          <span className="font-bold text-ink">{formatRs(offer.selling_price_paisa)}</span>
          {offer.eta_minutes ? (
            <span className="flex items-center gap-1">
              <Clock3 aria-hidden className="size-3.5" />
              {t("eta", { minutes: offer.eta_minutes })}
            </span>
          ) : null}
        </span>
      </span>
      <AddToCart
        quantity={quantity}
        onQuantityChange={(next) => setQuantity(offer, next)}
        productName={`${offer.name}, ${offer.shop_name}`}
      />
    </li>
  );
}

/**
 * A product up close, the way a shopper would turn it over in their hand: big photos, the
 * price against MRP, the sizes this dukan has, who sells it and on what terms, and similar
 * products to compare. The product it was opened for shows at once; the rest streams in.
 */
export function ProductSheet({
  product: opened,
  onClose,
}: {
  product: StorefrontProduct;
  onClose: () => void;
}) {
  const t = useTranslations("storefront");
  const tp = useTranslations("storefront.product");
  const tProduct = useTranslations("product");
  const locale = useLocale();
  // Picking a size or a similar product shows it in this same sheet.
  const [product, setProduct] = useState(opened);
  const scroller = useRef<HTMLDivElement>(null);
  const { data: detail, isPending, isError } = useProductDetail(product.id);
  const quantity = useLineQuantity(product.id);
  const setQuantity = useCustomerCart((state) => state.setQuantity);

  const urdu = locale === "ur" || locale === "sd";
  const name = urdu && product.name_ur ? product.name_ur : product.name;
  const off = product.mrp_paisa
    ? discountPercent(product.selling_price_paisa, product.mrp_paisa)
    : 0;
  const images = detail?.images ?? (product.image_path ? [product.image_path] : []);
  const category = detail?.category
    ? urdu && detail.category.name_ur
      ? detail.category.name_ur
      : detail.category.name
    : null;
  const blocked = detail ? !detail.shop.delivers_here : false;

  const show = (next: StorefrontProduct) => {
    setProduct(next);
    scroller.current?.scrollTo({ top: 0 });
  };

  const share = async () => {
    const url = `${window.location.origin}/shops/${product.shop_slug}?p=${product.id}`;
    const text = tp("shareText", { name, price: formatRs(product.selling_price_paisa) });
    try {
      if (navigator.share) await navigator.share({ title: name, text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast.success(tp("linkCopied"));
      }
    } catch {
      // The share sheet was closed without sharing: nothing to say.
    }
  };

  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent
        showHandle={false}
        className="h-[94dvh] max-h-[94dvh] overflow-hidden bg-canvas"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{name}</SheetTitle>
          <SheetDescription>{product.shop_name}</SheetDescription>
        </SheetHeader>
        <SheetBody ref={scroller} className="px-0 pb-0">
          <div className="relative">
            <Gallery
              key={product.id}
              images={images}
              name={name}
              brand={product.brand_name ?? undefined}
            />
            <button
              type="button"
              onClick={onClose}
              aria-label={tp("close")}
              className="absolute start-3 top-3 flex size-11 items-center justify-center rounded-full bg-surface/95 text-ink shadow-raised"
            >
              <ChevronDown aria-hidden className="size-6" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => void share()}
              aria-label={tp("share")}
              className="absolute end-3 top-3 flex size-11 items-center justify-center rounded-full bg-surface/95 text-ink shadow-raised"
            >
              <Share2 aria-hidden className="size-5" strokeWidth={1.75} />
            </button>
            {off > 0 ? (
              <span className="num absolute start-0 bottom-4 rounded-e-full bg-awning py-1 ps-3 pe-3.5 text-sm font-extrabold text-on-awning shadow-card">
                {tProduct("percentOff", { percent: off })}
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 px-4 pt-3 pb-6">
            <section className={card}>
              <ProductStars rating={product.rating} count={product.rating_count} className="mb-1" />
              <h2 className="font-heading text-xl leading-tight font-bold text-pretty text-ink">
                {name}
              </h2>
              {product.pack_size_label ? (
                <p className="num text-sm text-muted">{product.pack_size_label}</p>
              ) : null}
              <div className="num mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-heading text-3xl font-extrabold text-ink">
                  {formatRs(product.selling_price_paisa)}
                </span>
                {off > 0 && product.mrp_paisa ? (
                  <>
                    <span className="text-base text-muted line-through">
                      {tProduct("mrp")} {formatRs(product.mrp_paisa)}
                    </span>
                    <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-sm font-bold text-primary-strong">
                      {t("youSaveRs", {
                        amount: formatRs(product.mrp_paisa - product.selling_price_paisa),
                      })}
                    </span>
                  </>
                ) : null}
              </div>
              {product.low_stock ? (
                <p className="mt-1 text-sm font-semibold text-awning-ink">{t("lowStock")}</p>
              ) : null}
              {detail && detail.sizes.length > 1 ? (
                <SizePicker sizes={detail.sizes} current={product} onPick={show} />
              ) : null}
            </section>

            {blocked ? (
              <p
                role="status"
                className="flex items-start gap-2 rounded-2xl bg-awning-soft p-3.5 text-sm font-semibold text-awning-ink"
              >
                <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
                {t("shop.outOfArea")}
              </p>
            ) : null}

            {isPending ? <DetailSkeleton /> : null}
            {isError ? (
              <p role="alert" className="rounded-2xl bg-subtle p-3.5 text-sm text-muted">
                {tp("loadFailed")}
              </p>
            ) : null}

            {detail ? (
              <>
                <div className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1">
                  {product.brand_name ? (
                    <Fact label={tp("brand")} value={product.brand_name} />
                  ) : null}
                  {category ? <Fact label={tp("category")} value={category} /> : null}
                  {product.pack_size_label ? (
                    <Fact label={tp("size")} value={product.pack_size_label} />
                  ) : null}
                  {product.is_loose ? <Fact label={tp("soldAs")} value={tp("loose")} /> : null}
                </div>

                {detail.description ? (
                  <section className={card}>
                    <h3 className="font-heading text-base font-bold text-ink">{tp("about")}</h3>
                    <p className="mt-1 text-sm whitespace-pre-line text-ink" dir="auto">
                      {detail.description}
                    </p>
                  </section>
                ) : null}

                {product.brand_id && product.brand_name ? (
                  <Link
                    href={`/categories?brand=${product.brand_id}`}
                    onClick={onClose}
                    className={cn(card, "flex items-center gap-3 p-3")}
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-tint-amber text-awning-ink">
                      <Tag aria-hidden className="size-5" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">
                        {product.brand_name}
                      </span>
                      <span className="block text-sm text-muted">{tp("brandAll")}</span>
                    </span>
                    <ChevronRight
                      aria-hidden
                      className="size-5 shrink-0 text-muted rtl:-scale-x-100"
                    />
                  </Link>
                ) : null}

                <ShopRow shop={detail.shop} onNavigate={onClose} />

                {detail.offers.length > 0 ? (
                  <section className={card}>
                    <h3 className="font-heading text-base font-bold text-ink">
                      {tp("otherDukans")}
                    </h3>
                    <p className="text-sm text-muted">{tp("otherDukansHint")}</p>
                    <ul className="mt-1 flex flex-col divide-y divide-border/60">
                      {detail.offers.map((offer) => (
                        <OfferRow key={offer.id} offer={offer} />
                      ))}
                    </ul>
                  </section>
                ) : null}

                <Link
                  href="/refund-policy"
                  onClick={onClose}
                  className={cn(card, "flex items-center gap-3 p-3")}
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-mint-soft text-primary-strong">
                    <ShieldCheck aria-hidden className="size-5" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-ink">{t("freshPromise")}</span>
                  <ChevronRight
                    aria-hidden
                    className="size-5 shrink-0 text-muted rtl:-scale-x-100"
                  />
                </Link>

                {detail.similar.length > 0 ? (
                  <section className="flex flex-col gap-3 pt-2">
                    <h3 className="font-heading text-lg font-bold text-ink">{tp("similar")}</h3>
                    <div className="grid grid-cols-3 gap-x-2.5 gap-y-5">
                      {detail.similar.map((item) => (
                        <ProductTile
                          key={item.id}
                          product={item}
                          showShop={item.shop_id !== product.shop_id}
                          onOpen={() => show(item)}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}
          </div>
        </SheetBody>
        <SheetFooter className="items-center justify-between gap-3 bg-surface">
          <div className="num min-w-0">
            {product.pack_size_label ? (
              <p className="truncate text-sm text-muted">{product.pack_size_label}</p>
            ) : null}
            <p className="flex items-baseline gap-1.5">
              <span className="font-heading text-xl font-extrabold text-ink">
                {formatRs(product.selling_price_paisa * Math.max(quantity, 1))}
              </span>
              {off > 0 && product.mrp_paisa && quantity <= 1 ? (
                <span className="text-sm text-muted line-through">
                  {formatRs(product.mrp_paisa)}
                </span>
              ) : null}
            </p>
          </div>
          {quantity > 0 ? (
            <AddToCart
              size="lg"
              quantity={quantity}
              onQuantityChange={(next) => setQuantity(product, next)}
              productName={name}
            />
          ) : (
            <Button
              size="lg"
              className="min-w-44"
              disabled={blocked || !product.in_stock}
              onClick={() => {
                haptic("success");
                setQuantity(product, 1);
              }}
            >
              {product.in_stock ? tp("addToCart") : tProduct("outOfStock")}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
