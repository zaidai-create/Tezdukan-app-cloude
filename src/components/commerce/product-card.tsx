"use client";

import { cn } from "cn";
import { BellRing, Clock3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { discountPercent, formatRs, marginPercent, type Paisa } from "@/lib/money";
import { AddToCart } from "./add-to-cart";
import { Price } from "./price";
import { ProductImage } from "./product-image";

export type ProductUnitOption = {
  id: string;
  /** "Piece", "Dozen", "Carton" — already translated by the caller. */
  label: string;
  /** Pieces in one unit (1 for piece, 24 for a carton of 24). */
  baseQty: number;
  /** Price for one unit after the shop's tier pricing. */
  pricePaisa: Paisa;
  /** Regular price when a deal is running (drives the discount badge). */
  regularPricePaisa?: Paisa | null;
  /** MRP for one unit (MRP per piece × baseQty). */
  mrpPaisa: Paisa;
};

export type ProductCardData = {
  id: string;
  name: string;
  packSize: string;
  imageUrl?: string | null;
  units: readonly ProductUnitOption[];
  inStock: boolean;
  /** "12+1 free" */
  schemeLabel?: string | null;
  /** "Min 2 cartons" */
  moqLabel?: string | null;
  /** "Kal subah 10 baje tak" */
  etaLabel?: string | null;
  /** The dukandar's own selling price per piece (defaults to MRP) for the margin badge. */
  sellingPricePerPiecePaisa?: Paisa | null;
};

type ProductCardProps = {
  product: ProductCardData;
  unitId: string;
  onUnitChange: (unitId: string) => void;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  onNotifyMe?: () => void;
  notifyRequested?: boolean;
  /** Opens the product sheet (image and title are the tap targets). */
  onOpen?: () => void;
  priorityImage?: boolean;
  className?: string;
};

function ProductCard({
  product,
  unitId,
  onUnitChange,
  quantity,
  onQuantityChange,
  onNotifyMe,
  notifyRequested = false,
  onOpen,
  priorityImage = false,
  className,
}: ProductCardProps) {
  const t = useTranslations("product");
  const unit = product.units.find((u) => u.id === unitId) ?? product.units[0];
  if (!unit) return null;

  const perPiecePaisa = Math.round(unit.pricePaisa / unit.baseQty);
  const mrpPerPiecePaisa = Math.round(unit.mrpPaisa / unit.baseQty);
  const sellPerPiece = product.sellingPricePerPiecePaisa ?? mrpPerPiecePaisa;
  const margin = marginPercent(perPiecePaisa, sellPerPiece);
  const marginPerPiece = sellPerPiece - perPiecePaisa;
  const deal = unit.regularPricePaisa
    ? discountPercent(unit.pricePaisa, unit.regularPricePaisa)
    : 0;
  const multiUnit = product.units.length > 1;
  const image = (
    <ProductImage
      src={product.imageUrl}
      alt={product.name}
      priority={priorityImage}
      className={cn(!product.inStock && "opacity-60 grayscale")}
    />
  );

  return (
    <article
      data-slot="product-card"
      aria-label={product.name}
      className={cn(
        "relative flex flex-col rounded-lg border border-border bg-surface p-2.5 shadow-card",
        !product.inStock && "opacity-95",
        className,
      )}
    >
      <div className="relative">
        {image}
        {deal > 0 ? (
          <Badge variant="sale" size="sm" className="absolute start-1.5 top-1.5">
            {t("percentOff", { percent: deal })}
          </Badge>
        ) : null}
        {!product.inStock ? (
          <Badge variant="danger" size="sm" className="absolute end-1.5 top-1.5">
            {t("outOfStock")}
          </Badge>
        ) : null}
        {product.schemeLabel ? (
          <Badge variant="offer" size="sm" className="absolute start-1.5 bottom-1.5">
            {product.schemeLabel}
          </Badge>
        ) : null}
      </div>

      <div className="mt-2 flex flex-1 flex-col gap-1">
        {product.etaLabel ? (
          <p className="flex items-center gap-1 text-xs font-medium text-muted">
            <Clock3 aria-hidden className="size-3.5" />
            <span className="line-clamp-1">{product.etaLabel}</span>
          </p>
        ) : null}
        <h3 className="line-clamp-2 min-h-10 text-sm leading-5 font-semibold text-ink">
          {onOpen ? (
            // One control for details: the name, with its tap area stretched over the whole
            // card (the photo included). ADD and the stepper sit above it.
            <button
              type="button"
              onClick={onOpen}
              className="text-start after:absolute after:inset-0 after:rounded-lg"
            >
              {product.name}
            </button>
          ) : (
            product.name
          )}
        </h3>
        <p className="text-xs text-muted">
          {product.packSize}
          {product.moqLabel ? <span> · {product.moqLabel}</span> : null}
        </p>

        {multiUnit ? (
          <ToggleGroup
            type="single"
            value={unit.id}
            onValueChange={(value) => value && onUnitChange(value)}
            aria-label={t("unit")}
            className="relative z-10 mt-1 w-full p-0.5"
          >
            {product.units.map((option) => (
              <ToggleGroupItem
                key={option.id}
                value={option.id}
                className="h-8 flex-1 px-1.5 text-xs"
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}
        {multiUnit && unit.baseQty > 1 ? (
          <p className="text-xs text-muted">
            {t("unitConversion", { unit: unit.label, count: unit.baseQty })}
          </p>
        ) : null}

        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          {product.inStock && marginPerPiece > 0 ? (
            <Badge variant="primary" size="sm" className="num">
              {t("marginBadge", { percent: margin, amount: formatRs(marginPerPiece) })}
            </Badge>
          ) : null}
          <div className="relative z-10 flex items-end justify-between gap-2">
            <Price
              paisa={unit.pricePaisa}
              strikePaisa={unit.mrpPaisa}
              strikeLabel={t("mrp")}
              size="sm"
              className="flex-col items-start gap-0"
            />
            {product.inStock ? (
              <AddToCart
                quantity={quantity}
                onQuantityChange={onQuantityChange}
                productName={product.name}
              />
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="h-9 px-2.5 text-xs"
                onClick={onNotifyMe}
                disabled={notifyRequested}
                aria-pressed={notifyRequested}
              >
                <BellRing aria-hidden className="size-4" />
                {notifyRequested ? t("notifyRequested") : t("notifyMe")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export { ProductCard };
