"use client";

import { cn } from "cn";
import { BadgePercent, Clock3, Store } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { AddToCart } from "@/components/commerce/add-to-cart";
import { ProductImage } from "@/components/commerce/product-image";
import { ErrorState } from "@/components/states/error-state";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { formatRs } from "@/lib/money";
import { storageUrl } from "../images";
import { defaultUnit, localName, ltr, margin, schemeLabel, unitName } from "../labels";
import { quantityIn, useCart, useProductDetail, useProductSheet, useSetCartItem } from "../queries";
import type { CatalogItem, ProductDetail } from "../schemas";
import { CatalogCard } from "./catalog-card";
import { ProfitCalculator } from "./profit-calculator";

/**
 * Product detail as a bottom sheet over the page the dukandar is browsing: photo, price per
 * pack and per piece, profit, schemes, pack sizes with a large stepper, the same product from
 * other distributors and what is usually bought with it. One sheet per page.
 */
function ProductSheet({ shopId }: { shopId: string }) {
  const productId = useProductSheet((s) => s.productId);
  const close = useProductSheet((s) => s.close);
  const detail = useProductDetail(shopId, productId);
  const t = useTranslations("ordering");

  return (
    <Sheet open={productId !== null} onOpenChange={(open) => !open && close()}>
      <SheetContent className="lg:max-w-2xl">
        {detail.data && detail.data.item.distributor_product_id === productId ? (
          <ProductSheetBody key={productId} shopId={shopId} detail={detail.data} />
        ) : detail.isError ? (
          <SheetBody>
            <SheetTitle className="sr-only">{t("about")}</SheetTitle>
            <ErrorState
              compact
              onRetry={() => void detail.refetch()}
              retrying={detail.isFetching}
            />
          </SheetBody>
        ) : (
          <SheetBody aria-busy>
            <SheetTitle className="sr-only">{t("about")}</SheetTitle>
            <div className="flex flex-col gap-4 pt-1">
              <Skeleton className="mx-auto aspect-square w-full max-w-72 rounded-lg" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-12 w-full rounded-full" />
            </div>
          </SheetBody>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ProductSheetBody({ shopId, detail }: { shopId: string; detail: ProductDetail }) {
  const t = useTranslations("ordering");
  const locale = useLocale();
  const openSheet = useProductSheet((s) => s.open);
  const { data: cart } = useCart(shopId);
  const setCartItem = useSetCartItem(shopId);
  const item = detail.item;
  const [unitId, setUnitId] = useState(() => defaultUnit(item)?.id ?? "");
  const unit = item.pack_units.find((u) => u.id === unitId) ?? defaultUnit(item);
  const name = localName(item, locale);
  const profit = margin(item);
  const image = detail.images[0] ?? item.image_path;
  if (!unit) return null;
  const quantity = quantityIn(cart, item.distributor_product_id, unit.id);

  return (
    <SheetBody className="px-0 pb-0">
      <div className="px-5">
        <div className="relative mx-auto w-full max-w-72">
          <ProductImage
            src={storageUrl(image)}
            alt={name}
            priority
            sizes="288px"
            className={cn("rounded-xl shadow-raised", !item.in_stock && "opacity-60 grayscale")}
          />
        </div>

        <div className="mt-4 flex flex-col gap-1">
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Store aria-hidden className="size-4" />
            {item.org_name}
            {item.brand_name ? ` · ${item.brand_name}` : null}
          </p>
          <SheetTitle className="text-2xl leading-tight font-bold">{name}</SheetTitle>
          <SheetDescription>
            <bdi>{item.pack_size_label}</bdi>
            {locale === "ur" ? null : item.name_ur ? (
              <span lang="ur"> · {item.name_ur}</span>
            ) : null}
          </SheetDescription>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3 rounded-lg bg-subtle p-4">
          <div>
            <p dir="ltr" className="num flex items-baseline gap-2 rtl:justify-end">
              <span className="font-heading text-3xl font-extrabold text-ink">
                {formatRs(item.price_paisa * unit.base_qty)}
              </span>
              {item.mrp_paisa > item.price_paisa ? (
                <s className="text-sm text-muted">{formatRs(item.mrp_paisa * unit.base_qty)}</s>
              ) : null}
            </p>
            <p className="num mt-0.5 text-sm text-muted">
              {unitName(t, unit)}
              {unit.base_qty > 1
                ? ` · ${t("perPiece", { price: formatRs(item.price_paisa) })}`
                : null}
            </p>
          </div>
          {profit.perPiece > 0 ? (
            <div className="text-end">
              <p className="num font-heading text-lg font-bold text-primary-strong">
                {formatRs(profit.perPiece * unit.base_qty)}
              </p>
              <p className="num text-xs font-semibold text-primary-strong">
                {t("profitPercent", { percent: profit.percent })}
              </p>
            </div>
          ) : null}
        </div>

        {item.mrp_paisa > 0 ? (
          <ProfitCalculator
            key={unit.id}
            costPaisa={item.price_paisa}
            mrpPaisa={item.mrp_paisa}
            startPieces={(quantity || 1) * unit.base_qty}
            scheme={item.scheme}
          />
        ) : null}

        {item.pack_units.length > 1 ? (
          <fieldset className="mt-4">
            <legend className="mb-2 text-sm font-semibold text-ink">{t("packSize")}</legend>
            <div
              role="radiogroup"
              aria-label={t("packSize")}
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            >
              {item.pack_units.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={option.id === unit.id}
                  onClick={() => setUnitId(option.id)}
                  className={cn(
                    "num flex min-h-14 flex-col items-start justify-center rounded-md border-[1.5px] px-3 text-start transition-colors",
                    option.id === unit.id
                      ? "border-primary bg-primary-soft text-primary-strong"
                      : "border-border bg-surface text-ink hover:bg-subtle",
                  )}
                >
                  <span className="text-sm font-semibold">{unitName(t, option)}</span>
                  <span className="text-xs">{formatRs(item.price_paisa * option.base_qty)}</span>
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        {detail.schemes.length > 0 ? (
          <section className="mt-5">
            <h3 className="mb-2 text-sm font-semibold text-ink">{t("schemes")}</h3>
            <ul className="flex flex-col gap-2">
              {detail.schemes.map((scheme) => (
                <li
                  key={scheme.id}
                  className="flex items-start gap-3 rounded-md bg-awning-soft p-3"
                >
                  <BadgePercent aria-hidden className="mt-0.5 size-5 shrink-0 text-awning-ink" />
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{schemeLabel(t, scheme)}</p>
                    <p className="text-sm text-muted">
                      {locale === "ur" ? (scheme.name_ur ?? scheme.name) : scheme.name}
                    </p>
                    {scheme.ends_at ? (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-awning-ink">
                        <Clock3 aria-hidden className="size-3.5" />
                        {t("schemeEnds", { date: ltr(formatDate(scheme.ends_at)) })}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {detail.description ? (
          <section className="mt-5">
            <h3 className="mb-1 text-sm font-semibold text-ink">{t("about")}</h3>
            <p className="text-sm text-muted">{detail.description}</p>
          </section>
        ) : null}

        {detail.other_offers.length > 0 ? (
          <section className="mt-5">
            <h3 className="mb-2 text-sm font-semibold text-ink">{t("otherDistributors")}</h3>
            <ul className="flex flex-col gap-2">
              {detail.other_offers.map((offer) => (
                <OfferRow
                  key={offer.distributor_product_id}
                  offer={offer}
                  current={item}
                  onOpen={openSheet}
                />
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {detail.bought_together.length > 0 ? (
        <section className="mt-6">
          <h3 className="mb-2 px-5 text-sm font-semibold text-ink">{t("boughtTogether")}</h3>
          <div className="flex snap-x scroll-px-5 scrollbar-none gap-3 overflow-x-auto px-5 pb-2">
            {detail.bought_together.map((other) => (
              <CatalogCard
                key={other.distributor_product_id}
                item={other}
                shopId={shopId}
                layout="rail"
              />
            ))}
          </div>
        </section>
      ) : null}

      <div className="material sticky bottom-0 mt-4 flex items-center gap-3 border-t border-border/70 px-5 py-3">
        <div className="min-w-0 flex-1">
          <p className="num truncate font-heading text-lg font-bold text-ink">
            {formatRs(item.price_paisa * unit.base_qty * Math.max(quantity, 1))}
          </p>
          <p className="truncate text-xs text-muted">{unitName(t, unit)}</p>
        </div>
        <AddToCart
          size="lg"
          quantity={quantity}
          productName={name}
          minQuantity={Math.max(1, Math.ceil(item.moq_base_qty / unit.base_qty))}
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
      </div>
    </SheetBody>
  );
}

function OfferRow({
  offer,
  current,
  onOpen,
}: {
  offer: CatalogItem;
  current: CatalogItem;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("ordering");
  const cheaper = current.price_paisa - offer.price_paisa;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(offer.distributor_product_id)}
        className="flex min-h-14 w-full items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 text-start transition-colors hover:bg-subtle"
      >
        <Store aria-hidden className="size-5 shrink-0 text-muted" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink">{offer.org_name}</span>
          {cheaper > 0 ? (
            <span className="num block text-xs font-semibold text-primary-strong">
              {t("cheaperBy", { amount: formatRs(cheaper) })}
            </span>
          ) : null}
        </span>
        <span className="num font-heading font-bold text-ink">
          {t("perPiece", { price: formatRs(offer.price_paisa) })}
        </span>
      </button>
    </li>
  );
}

export { ProductSheet };
