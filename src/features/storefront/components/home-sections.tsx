import { cn } from "cn";
import { ArrowRight, ChevronRight } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ProductImage } from "@/components/commerce/product-image";
import { storageUrl } from "@/features/ordering/images";
import { Link } from "@/i18n/navigation";
import type { StorefrontCategory, StorefrontProduct } from "../schemas";

/** "See all products" under a shelf, with a peek at three more of them. */
export async function SeeAllPill({
  href,
  products,
}: {
  href: string;
  /** Up to three products shown as overlapping thumbnails. */
  products: StorefrontProduct[];
}) {
  const t = await getTranslations("storefront");
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-border/70 bg-surface px-4 text-base font-semibold text-primary shadow-card transition-transform duration-150 ease-out active:scale-[0.98]"
    >
      <span className="flex -space-x-3 rtl:space-x-reverse" aria-hidden>
        {products.slice(0, 3).map((product) => (
          <ProductImage
            key={product.id}
            src={storageUrl(product.image_path)}
            alt=""
            sizes="40px"
            className="size-10 rounded-full border-2 border-surface shadow-card"
          />
        ))}
      </span>
      {t("seeAllProducts")}
      <ChevronRight aria-hidden className="size-5 rtl:-scale-x-100" strokeWidth={1.75} />
    </Link>
  );
}

const spotlightStyles = [
  { card: "bg-awning text-on-awning", button: "bg-ink text-surface" },
  { card: "bg-forest text-on-forest", button: "bg-awning text-on-awning" },
  { card: "bg-mint-soft text-ink", button: "bg-action text-on-action" },
] as const;

/**
 * Big coloured cards, one per busy aisle, that swipe sideways: the store's window. Each says
 * what the aisle is and how much of it can be delivered right now.
 */
export async function CategorySpotlights({
  categories,
  locale,
}: {
  categories: StorefrontCategory[];
  locale: string;
}) {
  const t = await getTranslations("storefront");
  const urdu = locale === "ur" || locale === "sd";
  if (categories.length === 0) return null;
  return (
    <ul
      aria-label={t("spotlightsLabel")}
      className="-mx-4 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] gap-3 overflow-x-auto px-4"
    >
      {categories.map((category, index) => {
        const style = spotlightStyles[index % spotlightStyles.length] ?? spotlightStyles[0];
        const image = storageUrl(category.image_path);
        return (
          <li key={category.id} className="w-[84%] max-w-md shrink-0 snap-start">
            <Link
              href={`/categories?c=${category.id}`}
              className={cn(
                "relative flex min-h-44 overflow-hidden rounded-[22px] p-5 shadow-raised transition-transform duration-150 ease-out active:scale-[0.99]",
                style.card,
              )}
            >
              <span className="relative z-10 flex max-w-[58%] flex-col items-start gap-1.5">
                <span className="font-heading text-2xl leading-tight font-extrabold text-balance">
                  {urdu && category.name_ur ? category.name_ur : category.name}
                </span>
                <span className="num text-sm opacity-85">
                  {t("spotlightHint", { count: category.product_count })}
                </span>
                <span
                  className={cn(
                    "mt-auto inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold",
                    style.button,
                  )}
                >
                  {t("shopNow")}
                  <ArrowRight aria-hidden className="size-4 rtl:-scale-x-100" />
                </span>
              </span>
              {image ? (
                <span className="absolute end-3 top-1/2 size-32 -translate-y-1/2 overflow-hidden rounded-2xl shadow-raised ring-2 ring-surface/40">
                  <Image
                    src={image}
                    alt=""
                    fill
                    sizes="128px"
                    priority={index === 0}
                    className="object-cover"
                  />
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

const brandTints = ["bg-primary-soft", "bg-tint-amber", "bg-tint-sky", "bg-tint-peach"] as const;

export type BrandShelf = { id: string; name: string; products: StorefrontProduct[] };

/** Brands people know, each with three of its products: tap for everything from that brand. */
export async function BrandShowcase({ brands }: { brands: BrandShelf[] }) {
  const t = await getTranslations("storefront");
  if (brands.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {brands.map((brand, index) => (
        <Link
          key={brand.id}
          href={`/categories?brand=${brand.id}`}
          aria-label={t("brandAllNamed", { brand: brand.name })}
          className={cn(
            "flex flex-col items-center gap-3 rounded-[22px] p-3 pt-3.5 shadow-card transition-transform duration-150 ease-out active:scale-[0.98]",
            brandTints[index % brandTints.length],
          )}
        >
          <span className="max-w-full truncate rounded-full bg-surface px-4 py-1.5 font-heading text-base font-extrabold text-ink shadow-card">
            {brand.name}
          </span>
          <span className="grid w-full grid-cols-3 gap-1.5" aria-hidden>
            {brand.products.slice(0, 3).map((product) => (
              <ProductImage
                key={product.id}
                src={storageUrl(product.image_path)}
                alt=""
                sizes="56px"
                className="rounded-xl bg-surface"
              />
            ))}
          </span>
        </Link>
      ))}
    </div>
  );
}
