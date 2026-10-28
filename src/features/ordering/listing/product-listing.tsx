import { cn } from "cn";
import { ArrowLeft, BadgePercent, PackageCheck, SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { ProductGridSkeleton } from "@/components/states/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { CartBoundary } from "../components/cart-boundary";
import { CatalogCard } from "../components/catalog-card";
import { DukanCartBar } from "../components/dukan-cart-bar";
import { ProductSheet } from "../components/product-sheet";
import { browseCatalog, getCart, type BrowseOptions } from "../data";

export const sorts = ["popular", "price_asc", "price_desc", "margin_desc"] as const;
export type ListingSort = (typeof sorts)[number];

export type ListingParams = { sort?: string; stock?: string; schemes?: string };

export function readListingParams(params: ListingParams) {
  const sort = sorts.find((s) => s === params.sort) ?? "popular";
  return { sort, inStock: params.stock === "1", hasScheme: params.schemes === "1" };
}

function hrefWith(
  basePath: string,
  current: ReturnType<typeof readListingParams>,
  change: Partial<ReturnType<typeof readListingParams>>,
) {
  const next = { ...current, ...change };
  const query = new URLSearchParams();
  if (next.sort !== "popular") query.set("sort", next.sort);
  if (next.inStock) query.set("stock", "1");
  if (next.hasScheme) query.set("schemes", "1");
  const qs = query.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function Chip({
  href,
  selected,
  children,
}: {
  href: string;
  selected: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors after:absolute after:inset-x-0 after:-inset-y-1 [&_svg]:size-4",
        selected
          ? "border-primary bg-primary text-on-action"
          : "border-border-strong/40 bg-surface text-ink hover:bg-subtle",
      )}
    >
      {children}
    </Link>
  );
}

export function ListingSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 py-4" aria-hidden>
      <div className="flex flex-col gap-2 px-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex gap-2 overflow-hidden px-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-28 shrink-0 rounded-full" />
        ))}
      </div>
      <ProductGridSkeleton count={6} className="px-4" />
    </div>
  );
}

/**
 * A titled product grid for one category, brand or distributor, with sort and filter chips
 * kept in the URL (shareable, back-button friendly).
 */
export async function ProductListing({
  shopId,
  title,
  subtitle,
  basePath,
  backHref,
  params,
  browse,
  visual,
}: {
  shopId: string;
  title: string;
  subtitle?: string;
  basePath: string;
  backHref: string;
  params: ListingParams;
  browse: Omit<BrowseOptions, "sort" | "inStock" | "hasScheme">;
  /** Optional artwork beside the title (a category photo). */
  visual?: ReactNode;
}) {
  const t = await getTranslations("ordering");
  const tCommon = await getTranslations("common");
  const current = readListingParams(params);
  const [items, cart] = await Promise.all([
    browseCatalog(shopId, { ...browse, ...current, limit: 100 }),
    getCart(shopId),
  ]);
  const filtered = current.inStock || current.hasScheme;

  return (
    <CartBoundary shopId={shopId} cart={cart}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 py-4">
        <header className="flex items-center gap-3 px-4">
          <Link
            href={backHref}
            aria-label={tCommon("back")}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface shadow-card"
          >
            <ArrowLeft aria-hidden className="size-5 rtl:-scale-x-100" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-heading text-2xl leading-tight font-extrabold text-ink">
              {title}
            </h1>
            <p className="num truncate text-sm text-muted">
              {subtitle ?? t("products", { count: items.length })}
            </p>
          </div>
          {visual}
        </header>

        <nav
          className="flex scroll-px-4 scrollbar-none gap-2 overflow-x-auto px-4 py-1"
          aria-label={t("sortBy")}
        >
          {sorts.map((sort) => (
            <Chip
              key={sort}
              href={hrefWith(basePath, current, { sort })}
              selected={current.sort === sort}
            >
              {t(`sort.${sort}`)}
            </Chip>
          ))}
          <span aria-hidden className="mx-1 w-px shrink-0 bg-border" />
          <Chip
            href={hrefWith(basePath, current, { inStock: !current.inStock })}
            selected={current.inStock}
          >
            <PackageCheck aria-hidden />
            {t("filterInStock")}
          </Chip>
          <Chip
            href={hrefWith(basePath, current, { hasScheme: !current.hasScheme })}
            selected={current.hasScheme}
          >
            <BadgePercent aria-hidden />
            {t("filterSchemes")}
          </Chip>
        </nav>

        {items.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={t("noProducts")}
            description={t("noProductsHint")}
            action={
              filtered ? (
                <Link
                  href={hrefWith(basePath, current, { inStock: false, hasScheme: false })}
                  className="inline-flex h-12 items-center justify-center rounded-md bg-primary-soft px-5 font-semibold text-primary-strong"
                >
                  {t("clearFilters")}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {items.map((item, index) => (
              <CatalogCard
                key={item.distributor_product_id}
                item={item}
                shopId={shopId}
                priorityImage={index < 4}
              />
            ))}
          </div>
        )}
      </div>
      <ProductSheet shopId={shopId} />
      <DukanCartBar shopId={shopId} />
    </CartBoundary>
  );
}
