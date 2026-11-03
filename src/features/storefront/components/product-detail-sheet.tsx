"use client";

import { ChevronRight, ShieldCheck, Store } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { AddToCart } from "@/components/commerce/add-to-cart";
import { ProductImage } from "@/components/commerce/product-image";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { storageUrl } from "@/features/ordering/images";
import { Link } from "@/i18n/navigation";
import { haptic } from "@/lib/haptics";
import { discountPercent, formatRs } from "@/lib/money";
import { useCustomerCart, useLineQuantity } from "../cart-store";
import type { StorefrontProduct } from "../schemas";

/** A product up close: big photo, price against MRP, the dukan, and ADD or the stepper. */
export function ProductDetailSheet({
  product,
  onClose,
}: {
  product: StorefrontProduct;
  onClose: () => void;
}) {
  const t = useTranslations("storefront");
  const locale = useLocale();
  const quantity = useLineQuantity(product.id);
  const setQuantity = useCustomerCart((state) => state.setQuantity);
  const name = locale === "ur" && product.name_ur ? product.name_ur : product.name;
  const off = product.mrp_paisa
    ? discountPercent(product.selling_price_paisa, product.mrp_paisa)
    : 0;

  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent>
        <SheetHeader className="sr-only">
          <SheetTitle>{name}</SheetTitle>
          <SheetDescription>{product.shop_name}</SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-4">
          <div className="relative mx-auto w-full max-w-72">
            <ProductImage
              src={storageUrl(product.image_path)}
              alt={name}
              sizes="288px"
              priority
              className="aspect-square w-full rounded-2xl"
            />
            {off > 0 ? (
              <span className="num absolute start-3 top-3 rounded-full bg-awning px-3 py-1 text-sm font-bold text-on-awning shadow-card">
                {t("percentOff", { percent: off })}
              </span>
            ) : null}
          </div>
          <div>
            <h2 className="font-heading text-2xl leading-tight font-bold text-pretty text-ink">
              {name}
            </h2>
            {product.pack_size_label ? (
              <p className="text-base text-muted">{product.pack_size_label}</p>
            ) : null}
          </div>
          <div className="num flex items-baseline gap-2">
            <span className="font-heading text-3xl font-extrabold text-ink">
              {formatRs(product.selling_price_paisa)}
            </span>
            {off > 0 && product.mrp_paisa ? (
              <>
                <span className="text-base text-muted line-through">
                  {formatRs(product.mrp_paisa)}
                </span>
                <span className="text-sm font-bold text-primary-strong">
                  {t("youSaveRs", {
                    amount: formatRs(product.mrp_paisa - product.selling_price_paisa),
                  })}
                </span>
              </>
            ) : null}
          </div>
          <Link
            href={`/shops/${product.shop_slug}`}
            onClick={onClose}
            className="flex items-center gap-3 rounded-lg border border-border/60 bg-surface p-3 shadow-card"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
              <Store aria-hidden className="size-5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-muted">{t("soldBy")}</span>
              <span className="block truncate font-semibold text-ink">{product.shop_name}</span>
            </span>
            <ChevronRight aria-hidden className="size-5 text-muted rtl:-scale-x-100" />
          </Link>
          <p className="flex items-center gap-2 text-sm text-muted">
            <ShieldCheck aria-hidden className="size-4 text-primary" />
            {t("freshPromise")}
          </p>
        </SheetBody>
        <SheetFooter>
          <div className="flex items-center justify-between gap-3">
            <span className="num font-heading text-xl font-bold text-ink">
              {formatRs(product.selling_price_paisa * Math.max(quantity, 1))}
            </span>
            <AddToCart
              quantity={quantity}
              onQuantityChange={(next) => {
                haptic("tap");
                setQuantity(product, next);
              }}
              productName={name}
            />
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
