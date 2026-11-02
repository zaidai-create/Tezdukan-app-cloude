import { ChevronRight, MapPin, PackageSearch, Store, Truck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { cn } from "cn";
import { CategoryTile } from "@/components/commerce/category-tile";
import { EmptyState } from "@/components/states/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { categoryIcon, categoryTint } from "@/features/ordering/category-style";
import { storageUrl } from "@/features/ordering/images";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/session";
import { CartView } from "./components/cart-view";
import { CustomerCartBar } from "./components/customer-cart-bar";
import { ProductGrid } from "./components/product-grid";
import { SearchBar } from "./components/search-bar";
import { ShopCard } from "./components/shop-card";
import { ShopHeader } from "./components/shop-header";
import {
  getNearbyShops,
  getStorefrontCategories,
  getStorefrontProducts,
  getStorefrontShop,
} from "./data";
import type { StorefrontCategory } from "./schemas";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function PageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5" aria-hidden>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-13 w-full rounded-full" />
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="aspect-square rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-64 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ title, href, action }: { title: string; href?: string; action?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-heading text-lg font-bold text-ink lg:text-xl">{title}</h2>
      {href && action ? (
        <Link
          href={href}
          className="inline-flex min-h-12 items-center gap-0.5 text-sm font-semibold text-primary"
        >
          {action}
          <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
        </Link>
      ) : null}
    </div>
  );
}

const categoryName = (category: StorefrontCategory, locale: string) =>
  locale === "ur" && category.name_ur ? category.name_ur : category.name;

// ------------------------------------------------------------------------------------------------
// Home
// ------------------------------------------------------------------------------------------------

async function HomeContent() {
  await connection();
  const session = await requireRole("customer", "/");
  const [t, locale, categories, shops, products] = await Promise.all([
    getTranslations(),
    getLocale(),
    getStorefrontCategories(),
    getNearbyShops(),
    getStorefrontProducts({ limit: 24 }),
  ]);
  const firstName = session.fullName.split(" ")[0] ?? "";
  const hasDukan = session.contexts.some((context) => context.role === "dukandar");
  const hasDistributor = session.contexts.some((context) => context.role === "distributor");
  const stocked = categories.filter((category) => category.product_count > 0).slice(0, 8);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-ink lg:text-3xl">
          {firstName ? t("home.greetingNamed", { name: firstName }) : t("home.greeting")}
        </h1>
        <p className="flex items-center gap-1.5 text-sm font-medium text-muted">
          <MapPin aria-hidden className="size-4 text-primary" />
          {t("storefront.deliveringIn")}
        </p>
      </header>

      <SearchBar />

      {stocked.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeader
            title={t("storefront.categoriesTitle")}
            href="/categories"
            action={t("storefront.seeAll")}
          />
          <div className="grid grid-cols-4 gap-x-3 gap-y-4 sm:grid-cols-8">
            {stocked.map((category) => (
              <CategoryTile
                key={category.id}
                href={`/categories?c=${category.id}`}
                name={categoryName(category, locale)}
                imageUrl={storageUrl(category.image_path)}
                icon={categoryIcon(category.slug)}
                tint={categoryTint(category.tint)}
              />
            ))}
          </div>
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

      {products.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeader
            title={t("storefront.popularTitle")}
            href="/categories"
            action={t("storefront.seeAll")}
          />
          <ProductGrid products={products} />
        </section>
      ) : (
        <EmptyState
          icon={PackageSearch}
          title={t("storefront.shops.empty")}
          description={t("storefront.shops.emptyHint")}
        />
      )}

      {hasDukan && hasDistributor ? null : (
        <section className="flex flex-col gap-3">
          <SectionHeader title={t("storefront.growTitle")} />
          <div className="grid gap-3 sm:grid-cols-2">
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

      <CustomerCartBar />
    </div>
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
// Categories and search
// ------------------------------------------------------------------------------------------------

async function CategoriesContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  await requireRole("customer", "/categories");
  const params = await searchParams;
  const query = first(params.q)?.trim().slice(0, 80) || undefined;
  const categoryParam = first(params.c);
  const [t, locale, categories] = await Promise.all([
    getTranslations("storefront"),
    getLocale(),
    getStorefrontCategories(),
  ]);
  const stocked = categories.filter((category) => category.product_count > 0);
  const selected = stocked.find((category) => category.id === categoryParam);
  const products = await getStorefrontProducts({
    categoryId: query ? undefined : selected?.id,
    query,
    limit: 120,
  });
  const chip = (active: boolean) =>
    cn(
      "relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors after:absolute after:inset-x-0 after:-inset-y-1",
      active
        ? "border-primary bg-primary-soft text-primary-strong"
        : "border-border bg-surface text-ink",
    );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5">
      <h1 className="font-heading text-2xl font-bold text-ink lg:text-3xl">
        {t("categories.title")}
      </h1>
      <SearchBar defaultValue={query} />
      <nav
        aria-label={t("categories.title")}
        className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1"
      >
        <Link
          href="/categories"
          scroll={false}
          className={chip(!selected && !query)}
          aria-current={!selected && !query ? "page" : undefined}
        >
          {t("categories.all")}
        </Link>
        {stocked.map((category) => (
          <Link
            key={category.id}
            href={`/categories?c=${category.id}`}
            scroll={false}
            className={chip(category.id === selected?.id && !query)}
            aria-current={category.id === selected?.id && !query ? "page" : undefined}
          >
            {categoryName(category, locale)}
            <span className="num text-xs opacity-70">{category.product_count}</span>
          </Link>
        ))}
      </nav>
      {query ? (
        <p className="text-base font-semibold text-ink">{t("categories.resultsFor", { query })}</p>
      ) : null}
      {products.length > 0 ? (
        <ProductGrid products={products} />
      ) : (
        <EmptyState
          icon={PackageSearch}
          title={t("categories.empty")}
          description={t("categories.emptyHint")}
        />
      )}
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
// Nearby shops and one shop
// ------------------------------------------------------------------------------------------------

async function ShopsContent() {
  await connection();
  await requireRole("customer", "/shops");
  const [t, shops] = await Promise.all([getTranslations("storefront"), getNearbyShops()]);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
      <header>
        <h1 className="font-heading text-2xl font-bold text-ink lg:text-3xl">{t("shops.title")}</h1>
        <p className="text-base text-muted">{t("shops.subtitle")}</p>
      </header>
      {shops.length > 0 ? (
        <div className="flex flex-col gap-3">
          {shops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} />
          ))}
        </div>
      ) : (
        <EmptyState icon={Store} title={t("shops.empty")} description={t("shops.emptyHint")} />
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

async function ShopContent({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  await requireRole("customer", `/shops/${slug}`);
  const [t, shop] = await Promise.all([getTranslations("storefront"), getStorefrontShop(slug)]);
  if (!shop) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <EmptyState icon={Store} title={t("shop.notFound")} />
      </div>
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5">
      <ShopHeader shop={shop} />
      {shop.is_live && shop.products.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeader title={t("shop.products")} />
          <ProductGrid products={shop.products} showShop={false} />
        </section>
      ) : (
        <EmptyState
          icon={PackageSearch}
          title={shop.is_live ? t("shop.empty") : t("shop.notLive")}
          description={shop.is_live ? t("shop.emptyHint") : undefined}
        />
      )}
      <CustomerCartBar />
    </div>
  );
}

export function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ShopContent params={params} />
    </Suspense>
  );
}

// ------------------------------------------------------------------------------------------------
// Cart
// ------------------------------------------------------------------------------------------------

async function CartContent() {
  await connection();
  const session = await requireRole("customer", "/cart");
  const shops = await getNearbyShops();
  return <CartView shops={shops} customerName={session.fullName} customerPhone={session.phone} />;
}

export function CustomerCartPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CartContent />
    </Suspense>
  );
}
