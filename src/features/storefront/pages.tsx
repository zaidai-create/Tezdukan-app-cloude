import { ChevronRight, CircleAlert, PackageSearch, Store, Truck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { cn } from "cn";
import { EmptyState } from "@/components/states/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/session";
import { getMyAddresses } from "@/features/addresses/data";
import { BackToTop } from "./components/back-to-top";
import { CartView } from "./components/cart-view";
import { CategoryDirectory } from "./components/category-directory";
import { CategoryTabs } from "./components/category-tabs";
import { CustomerCartBar } from "./components/customer-cart-bar";
import {
  BrandShowcase,
  CategorySpotlights,
  SeeAllPill,
  type BrandShelf,
} from "./components/home-sections";
import { ProductGrid, ProductRail } from "./components/product-grid";
import { DeliveryPill } from "./components/checkout/address-section";
import { LocationPrompt } from "./components/location-picker";
import { getCustomerLocation } from "./location";
import { SearchScreen } from "./components/search-screen";
import { ShopCard } from "./components/shop-card";
import { ShopHeader } from "./components/shop-header";
import { ShopReviews } from "./components/shop-reviews";
import { ShopShelf } from "./components/shop-shelf";
import {
  getDeliveryZones,
  getNearbyShops,
  getStorefrontBrands,
  getStorefrontCategories,
  getStorefrontProducts,
  getStorefrontShop,
  getBuyAgain,
  shopDeliversHere,
} from "./data";
import {
  productSorts,
  type ProductSort,
  type StorefrontCategory,
  type StorefrontProduct,
} from "./schemas";
import { ActiveOrderCard } from "@/features/customer-orders/components/order-parts";
import { getMyCustomerOrders } from "@/features/customer-orders/data";
import { discountPercent } from "@/lib/money";

const activeStatuses = ["placed", "accepted", "packed", "out_for_delivery"] as const;
const isActive = (status: string) => (activeStatuses as readonly string[]).includes(status);

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** A shelf: three tiles across with a line for the size, the price and the name under each. */
function ShelfSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="grid grid-cols-3 gap-x-2.5 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: rows * 3 }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="aspect-square rounded-2xl" />
          <Skeleton className="h-3.5 w-12 rounded-sm" />
          <Skeleton className="h-4 w-16 rounded-sm" />
          <Skeleton className="h-4 w-full rounded-sm" />
        </div>
      ))}
    </div>
  );
}

function TabsSkeleton() {
  return (
    <div className="-mx-4 flex gap-4 overflow-hidden border-b border-border/70 px-4 pt-2 pb-2.5">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex w-14 shrink-0 flex-col items-center gap-1.5">
          <Skeleton className="size-6 rounded-md" />
          <Skeleton className="h-3 w-12 rounded-sm" />
        </div>
      ))}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-5" aria-hidden>
      <TabsSkeleton />
      <Skeleton className="h-44 w-full rounded-[22px]" />
      <Skeleton className="h-6 w-32" />
      <ShelfSkeleton />
    </div>
  );
}

function SectionHeader({ title, href, action }: { title: string; href?: string; action?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-heading text-xl font-bold text-ink">{title}</h2>
      {href && action ? (
        <Link
          href={href}
          className="inline-flex min-h-12 shrink-0 items-center gap-0.5 text-sm font-semibold text-primary"
        >
          {action}
          <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
        </Link>
      ) : null}
    </div>
  );
}

const isUrdu = (locale: string) => locale === "ur" || locale === "sd";
const categoryName = (category: StorefrontCategory, locale: string) =>
  isUrdu(locale) && category.name_ur ? category.name_ur : category.name;

/** Brands with at least three products on the shelf, the fullest first. */
function brandShelves(products: StorefrontProduct[]): BrandShelf[] {
  const byBrand = new Map<string, BrandShelf>();
  for (const product of products) {
    if (!product.brand_id || !product.brand_name) continue;
    const shelf = byBrand.get(product.brand_id) ?? {
      id: product.brand_id,
      name: product.brand_name,
      products: [],
    };
    shelf.products.push(product);
    byBrand.set(product.brand_id, shelf);
  }
  return (
    [...byBrand.values()]
      // A brand card shows three packs: it needs three products, two of them with a photo.
      .filter(
        (shelf) =>
          shelf.products.length >= 3 &&
          shelf.products.filter((product) => product.image_path).length >= 2,
      )
      // Photos first inside a brand, so its card shows real packs where there are any.
      .map((shelf) => ({
        ...shelf,
        products: [...shelf.products].sort(
          (a, b) => Number(Boolean(b.image_path)) - Number(Boolean(a.image_path)),
        ),
      }))
      .sort((a, b) => b.products.length - a.products.length)
      .slice(0, 4)
  );
}

// ------------------------------------------------------------------------------------------------
// Home: the store's front, one aisle after another
// ------------------------------------------------------------------------------------------------

async function HomeContent() {
  await connection();
  const session = await requireRole("customer", "/");
  const [t, locale, categories, shops, allProducts, addresses, orders, buyAgain, location, zones] =
    await Promise.all([
      getTranslations(),
      getLocale(),
      getStorefrontCategories(),
      getNearbyShops(),
      getStorefrontProducts({ limit: 150 }),
      getMyAddresses(),
      getMyCustomerOrders(session.userId),
      getBuyAgain(12),
      getCustomerLocation(),
      getDeliveryZones(),
    ]);
  const active = orders.find((order) => isActive(order.status));
  // Deals: the biggest savings against MRP first.
  const deals = allProducts
    .filter((product) => product.mrp_paisa && product.mrp_paisa > product.selling_price_paisa)
    .sort(
      (a, b) =>
        discountPercent(b.selling_price_paisa, b.mrp_paisa ?? 0) -
        discountPercent(a.selling_price_paisa, a.mrp_paisa ?? 0),
    )
    .slice(0, 12);
  const firstName = session.fullName.split(" ")[0] ?? "";
  const hasDukan = session.contexts.some((context) => context.role === "dukandar");
  const hasDistributor = session.contexts.some((context) => context.role === "distributor");
  const stocked = categories.filter((category) => category.product_count > 0);
  // One shelf per aisle, like walking through a store: the fullest categories first.
  const shelves = stocked
    .map((category) => ({
      category,
      products: allProducts.filter((product) => product.category_id === category.id),
    }))
    .filter((shelf) => shelf.products.length >= 3)
    .sort((a, b) => b.products.length - a.products.length)
    .slice(0, 5);
  const brands = brandShelves(allProducts);
  const spotlights = [...stocked]
    .filter((category) => category.image_path)
    .sort((a, b) => b.product_count - a.product_count)
    .slice(0, 5);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-4 pb-5">
      <h1 className="sr-only">
        {firstName ? t("home.greetingNamed", { name: firstName }) : t("home.greeting")}
      </h1>
      {stocked.length > 0 ? (
        <CategoryTabs
          categories={stocked}
          activeId={null}
          locale={locale}
          label={t("storefront.categoriesTitle")}
          allLabel={t("storefront.categories.all")}
        />
      ) : null}

      {/* Dukans deliver only so far: nothing is shown until we know where the shopper is. */}
      {location ? null : <LocationPrompt addresses={addresses} zones={zones} />}
      {location && shops.length === 0 ? (
        <EmptyState
          icon={Store}
          title={t("storefront.location.noDukans")}
          description={t("storefront.location.noDukansHint")}
        />
      ) : null}

      {active ? <ActiveOrderCard order={active} /> : null}

      <CategorySpotlights categories={spotlights} locale={locale} />

      {buyAgain.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeader title={t("storefront.buyAgainTitle")} />
          <ProductRail products={buyAgain} label={t("storefront.buyAgainTitle")} />
        </section>
      ) : null}

      {deals.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeader
            title={t("storefront.dealsTitle")}
            href="/categories?sort=discount"
            action={t("storefront.seeAll")}
          />
          <ProductRail products={deals} label={t("storefront.dealsTitle")} />
        </section>
      ) : null}

      {shelves.slice(0, 2).map(({ category, products }) => (
        <Shelf
          key={category.id}
          title={categoryName(category, locale)}
          href={`/categories?c=${category.id}`}
          products={products}
        />
      ))}

      {brands.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeader title={t("storefront.brandsTitle")} />
          <BrandShowcase brands={brands} />
        </section>
      ) : null}

      {shops.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeader
            title={t("storefront.nearbyTitle")}
            href="/shops"
            action={t("storefront.seeAll")}
          />
          <div className="-mx-4 flex snap-x [scrollbar-width:none] gap-3 overflow-x-auto px-4 pb-1">
            {shops.slice(0, 8).map((shop) => (
              <ShopCard key={shop.id} shop={shop} compact />
            ))}
          </div>
        </section>
      ) : null}

      {shelves.slice(2).map(({ category, products }) => (
        <Shelf
          key={category.id}
          title={categoryName(category, locale)}
          href={`/categories?c=${category.id}`}
          products={products}
        />
      ))}

      {location && shops.length > 0 && allProducts.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title={t("storefront.shops.empty")}
          description={t("storefront.shops.emptyHint")}
        />
      ) : null}

      {hasDukan && hasDistributor ? null : (
        <section className="flex flex-col gap-3">
          <SectionHeader title={t("storefront.growTitle")} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {hasDukan ? null : (
              <GrowCard
                href="/start/dukan"
                icon="store"
                title={t("account.registerDukan")}
                hint={t("storefront.becomeShopkeeperHint")}
              />
            )}
            {hasDistributor ? null : (
              <GrowCard
                href="/start/distributor"
                icon="truck"
                title={t("account.becomeDistributor")}
                hint={t("storefront.becomeDistributorHint")}
              />
            )}
          </div>
        </section>
      )}

      <BackToTop />
      <CustomerCartBar />
    </div>
  );
}

/** One aisle on the home feed: two rows of its products, then the way to the rest. */
function Shelf({
  title,
  href,
  products,
}: {
  title: string;
  href: string;
  products: StorefrontProduct[];
}) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title={title} />
      <ProductGrid products={products.slice(0, 6)} />
      {products.length > 6 ? <SeeAllPill href={href} products={products.slice(6, 9)} /> : null}
    </section>
  );
}

function GrowCard({
  href,
  icon,
  title,
  hint,
}: {
  href: string;
  icon: "store" | "truck";
  title: string;
  hint: string;
}) {
  const Icon = icon === "store" ? Store : Truck;
  return (
    <Link
      href={href}
      className="flex min-h-20 items-center gap-3 rounded-lg border border-border/60 bg-surface p-4 shadow-card transition-transform duration-150 ease-out active:scale-[0.98]"
    >
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-md",
          icon === "store"
            ? "bg-primary-soft text-primary-strong"
            : "bg-awning-soft text-awning-ink",
        )}
      >
        <Icon aria-hidden className="size-6" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{title}</span>
        <span className="block text-sm text-muted">{hint}</span>
      </span>
      <ChevronRight aria-hidden className="size-5 text-muted rtl:-scale-x-100" />
    </Link>
  );
}

export function StorefrontHome() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

// ------------------------------------------------------------------------------------------------
// Categories: the store's signs, then one aisle or one brand in the order the shopper asks for
// ------------------------------------------------------------------------------------------------

async function CategoriesContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  await requireRole("customer", "/categories");
  const params = await searchParams;
  const query = first(params.q)?.trim().slice(0, 80) || undefined;
  const categoryParam = first(params.c);
  const brandParam = first(params.brand);
  const sortParam = first(params.sort);
  const sort: ProductSort = productSorts.find((option) => option === sortParam) ?? "relevance";
  const [t, locale, categories, location] = await Promise.all([
    getTranslations("storefront"),
    getLocale(),
    getStorefrontCategories(),
    getCustomerLocation(),
  ]);
  if (!location) {
    const [addresses, zones] = await Promise.all([getMyAddresses(), getDeliveryZones()]);
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
        <LocationPrompt addresses={addresses} zones={zones} />
      </div>
    );
  }
  const stocked = categories.filter((category) => category.product_count > 0);
  const selected = query ? undefined : stocked.find((category) => category.id === categoryParam);
  const brand = brandParam
    ? (await getStorefrontBrands()).find((candidate) => candidate.id === brandParam)
    : undefined;

  // The Categories tab itself: every aisle under its sign.
  if (!query && !selected && !brand && sort === "relevance") {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pt-4 pb-5">
        <h1 className="sr-only">{t("categories.title")}</h1>
        {stocked.length > 0 ? (
          <CategoryDirectory categories={stocked} locale={locale} />
        ) : (
          <EmptyState
            icon={PackageSearch}
            title={t("categories.empty")}
            description={t("location.noDukansHint")}
          />
        )}
        <CustomerCartBar />
      </div>
    );
  }

  const products = await getStorefrontProducts({
    categoryId: selected?.id,
    brandId: brand?.id,
    query,
    sort,
    limit: 150,
  });
  const brandName = brand ? (isUrdu(locale) && brand.name_ur ? brand.name_ur : brand.name) : null;
  const title = query
    ? t("categories.resultsFor", { query })
    : brandName
      ? t("categories.brandTitle", { brand: brandName })
      : selected
        ? categoryName(selected, locale)
        : sort === "discount"
          ? t("dealsTitle")
          : t("popularTitle");
  // Sorting keeps whatever is being looked at.
  const sortHref = (option: ProductSort) => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (selected) next.set("c", selected.id);
    if (brand) next.set("brand", brand.id);
    if (option !== "relevance") next.set("sort", option);
    const text = next.toString();
    return text ? `/categories?${text}` : "/categories";
  };
  const chip = (active: boolean) =>
    cn(
      "relative inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors after:absolute after:inset-x-0 after:-inset-y-1",
      active
        ? "border-primary bg-primary-soft text-primary-strong"
        : "border-border bg-surface text-ink",
    );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pb-5">
      <CategoryTabs
        categories={stocked}
        activeId={selected?.id ?? ""}
        locale={locale}
        label={t("categories.title")}
        allLabel={t("categories.all")}
      />
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-heading text-xl font-bold text-ink lg:text-2xl">{title}</h1>
        <p className="num shrink-0 text-sm text-muted">
          {t("categories.count", { count: products.length })}
        </p>
      </div>
      <nav
        aria-label={t("sort.label")}
        className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1"
      >
        {productSorts.map((option) => (
          <Link
            key={option}
            href={sortHref(option)}
            scroll={false}
            className={chip(option === sort)}
            aria-current={option === sort ? "true" : undefined}
          >
            {t(`sort.${option}`)}
          </Link>
        ))}
      </nav>
      {products.length > 0 ? (
        <ProductGrid products={products} />
      ) : (
        <EmptyState
          icon={PackageSearch}
          title={t("categories.empty")}
          description={t("categories.emptyHint")}
        />
      )}
      <BackToTop />
      <CustomerCartBar />
    </div>
  );
}

export function StorefrontCategoriesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CategoriesContent searchParams={searchParams} />
    </Suspense>
  );
}

// ------------------------------------------------------------------------------------------------
// Search
// ------------------------------------------------------------------------------------------------

async function SearchContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  await requireRole("customer", "/search");
  const [params, location] = await Promise.all([searchParams, getCustomerLocation()]);
  if (!location) {
    const [addresses, zones] = await Promise.all([getMyAddresses(), getDeliveryZones()]);
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
        <LocationPrompt addresses={addresses} zones={zones} />
      </div>
    );
  }
  const [categories, brands] = await Promise.all([
    getStorefrontCategories(),
    getStorefrontBrands(),
  ]);
  return (
    <>
      <SearchScreen
        categories={categories.filter((category) => category.product_count > 0)}
        brands={brands}
        initialQuery={first(params.q)?.trim().slice(0, 80) ?? ""}
      />
      <CustomerCartBar />
    </>
  );
}

export function StorefrontSearchPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SearchContent searchParams={searchParams} />
    </Suspense>
  );
}

// ------------------------------------------------------------------------------------------------
// Nearby shops and one shop
// ------------------------------------------------------------------------------------------------

async function ShopsContent() {
  await connection();
  await requireRole("customer", "/shops");
  const [t, shops, location, addresses, zones] = await Promise.all([
    getTranslations("storefront"),
    getNearbyShops(),
    getCustomerLocation(),
    getMyAddresses(),
    getDeliveryZones(),
  ]);
  if (!location) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
        <LocationPrompt addresses={addresses} zones={zones} />
      </div>
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
      <header>
        <h1 className="font-heading text-2xl font-bold text-ink lg:text-3xl">{t("shops.title")}</h1>
        <p className="text-base text-muted">{t("shops.subtitle")}</p>
      </header>
      <DeliveryPill
        addresses={addresses}
        zones={zones}
        selectedId={location.addressId}
        locationLabel={location.label}
        etaMinutes={null}
      />
      {shops.length > 0 ? (
        <div className="flex flex-col gap-3">
          {shops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Store}
          title={t("location.noDukans")}
          description={t("location.noDukansHint")}
        />
      )}
      <CustomerCartBar />
    </div>
  );
}

export function NearbyShopsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ShopsContent />
    </Suspense>
  );
}

async function ShopContent({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: SearchParams;
}) {
  await connection();
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  await requireRole("customer", `/shops/${slug}`);
  const [t, locale, shop, categories] = await Promise.all([
    getTranslations("storefront"),
    getLocale(),
    getStorefrontShop(slug),
    getStorefrontCategories(),
  ]);
  if (!shop) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <EmptyState icon={Store} title={t("shop.notFound")} />
      </div>
    );
  }
  // A shared link can open a dukan that is too far away: say so before the cart fills up.
  const deliversHere = await shopDeliversHere(shop.id);
  const stockedIds = new Set(shop.products.map((product) => product.category_id));
  const aisles = categories
    .filter((category) => stockedIds.has(category.id))
    .map((category) => ({ id: category.id, name: categoryName(category, locale) }));
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5">
      <ShopHeader shop={shop} />
      {deliversHere ? null : (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg bg-awning-soft p-4 text-awning-ink"
        >
          <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
          <div>
            <p className="font-semibold">{t("shop.outOfArea")}</p>
            <p className="text-sm">{t("shop.outOfAreaHint")}</p>
          </div>
        </div>
      )}
      {shop.is_live && shop.products.length > 0 ? (
        <ShopShelf products={shop.products} categories={aisles} openId={first(query.p)} />
      ) : (
        <EmptyState
          icon={PackageSearch}
          title={shop.is_live ? t("shop.empty") : t("shop.notLive")}
          description={shop.is_live ? t("shop.emptyHint") : undefined}
        />
      )}
      <ShopReviews reviews={shop.reviews} rating={shop.rating} count={shop.rating_count} />
      <BackToTop />
      <CustomerCartBar />
    </div>
  );
}

export function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ShopContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

// ------------------------------------------------------------------------------------------------
// Cart
// ------------------------------------------------------------------------------------------------

async function CartContent() {
  await connection();
  await requireRole("customer", "/cart");
  const [shops, addresses, zones, location] = await Promise.all([
    getNearbyShops(),
    getMyAddresses(),
    getDeliveryZones(),
    getCustomerLocation(),
  ]);
  return (
    <CartView
      shops={shops}
      addresses={addresses}
      zones={zones}
      selectedAddressId={location?.addressId ?? null}
    />
  );
}

export function CustomerCartPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CartContent />
    </Suspense>
  );
}
