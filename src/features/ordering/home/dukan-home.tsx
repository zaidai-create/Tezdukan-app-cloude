import { ChevronRight, Star, Store, Truck, Wallet } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { CategoryTile } from "@/components/commerce/category-tile";
import { ProductCardSkeleton } from "@/components/states/skeletons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { formatRs } from "@/lib/money";
import { categoryIcon, categoryTint } from "../category-style";
import { BannerCarousel } from "../components/banner-carousel";
import { CartBoundary } from "../components/cart-boundary";
import { CatalogCard } from "../components/catalog-card";
import { DukanCartBar } from "../components/dukan-cart-bar";
import { ProductSheet } from "../components/product-sheet";
import { SearchEntry } from "../components/search-entry";
import { Rail, Section } from "../components/section";
import { getCart, getHomeFeed, getShopDistributors, requireDukan } from "../data";
import { storageUrl } from "../images";
import { deliveryDay, localName, slotWindow } from "../labels";

function DukanHomeSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-4" aria-hidden>
      <div className="flex flex-col gap-3 px-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-14 w-full rounded-full" />
      </div>
      <Skeleton className="mx-4 h-40 rounded-xl" />
      <div className="grid grid-cols-4 gap-3 px-4 sm:grid-cols-6 lg:grid-cols-8">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
      <div className="flex gap-3 overflow-hidden px-4">
        {Array.from({ length: 3 }, (_, i) => (
          <ProductCardSkeleton key={i} className="w-[164px] shrink-0" />
        ))}
      </div>
    </div>
  );
}

async function DukanHomeContent() {
  await connection();
  const { session, shopId } = await requireDukan("/dukan");
  const [feed, cart, distributors, t, locale] = await Promise.all([
    getHomeFeed(shopId),
    getCart(shopId),
    getShopDistributors(shopId),
    getTranslations("ordering"),
    getLocale(),
  ]);
  const tHome = await getTranslations("home");
  const tCommon = await getTranslations("common");
  const firstName = session.fullName.split(" ")[0] ?? "";
  const next = feed.delivery[0];
  const owed = distributors.reduce((sum, d) => sum + Math.max(d.balance_paisa, 0), 0);
  const owing = distributors.filter((d) => d.balance_paisa > 0).length;

  return (
    <CartBoundary shopId={shopId} cart={cart}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 py-4 lg:px-4">
        <header className="flex flex-col gap-3 px-4">
          <div>
            <p className="text-sm text-muted">
              {firstName ? tHome("greetingNamed", { name: firstName }) : tHome("greeting")}
            </p>
            {next ? (
              <>
                <h1 className="mt-0.5 font-heading text-2xl leading-tight font-extrabold text-ink lg:text-3xl">
                  {t("deliveryPromise", {
                    day: deliveryDay(t, next.next_slot_start),
                    window: slotWindow(t, next.next_slot_start, next.next_slot_end),
                  })}
                </h1>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                  <Truck aria-hidden className="size-4 text-primary-strong" />
                  {t("deliveryBy", { name: next.org_name })}
                  {feed.delivery.length > 1 ? ` +${feed.delivery.length - 1}` : null}
                </p>
              </>
            ) : null}
          </div>
          <SearchEntry />
        </header>

        <BannerCarousel banners={feed.banners} />

        {feed.categories.length > 0 ? (
          <Section
            title={t("sections.categories")}
            action={{ href: "/dukan/categories", label: t("seeAllCategories") }}
          >
            <div className="grid grid-cols-4 gap-x-3 gap-y-4 sm:grid-cols-6 lg:grid-cols-8">
              {feed.categories.slice(0, 8).map((category) => (
                <CategoryTile
                  key={category.id}
                  href={`/dukan/categories/${category.slug}`}
                  name={localName(category, locale)}
                  imageUrl={storageUrl(category.image_path)}
                  icon={categoryIcon(category.slug)}
                  tint={categoryTint(category.tint)}
                />
              ))}
            </div>
          </Section>
        ) : null}

        {feed.order_again.length > 0 ? (
          <Section title={t("sections.orderAgain")} hint={t("sections.orderAgainHint")} bleed>
            <Rail>
              {feed.order_again.map((item, index) => (
                <CatalogCard
                  key={item.distributor_product_id}
                  item={item}
                  shopId={shopId}
                  layout="rail"
                  priorityImage={index < 2}
                />
              ))}
            </Rail>
          </Section>
        ) : null}

        {feed.deals.length > 0 ? (
          <Section title={t("sections.deals")} hint={t("sections.dealsHint")}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {feed.deals.map((item) => (
                <CatalogCard key={item.distributor_product_id} item={item} shopId={shopId} />
              ))}
            </div>
          </Section>
        ) : null}

        <div className="px-4">
          <Link
            href="/dukan/ledger"
            className="flex items-center gap-4 rounded-lg border border-border/70 bg-surface p-4 shadow-card transition-transform active:scale-[0.99]"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-awning-soft text-awning-ink">
              <Wallet aria-hidden className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-base font-bold text-ink">
                {t("sections.khata")}
              </span>
              <span className="block text-sm text-muted">
                {owed > 0 ? t("khataAcross", { count: owing }) : t("khataClear")}
              </span>
            </span>
            <span className="text-end">
              <span className="num block font-heading text-lg font-extrabold text-ink">
                {formatRs(owed)}
              </span>
              <span className="flex items-center justify-end gap-0.5 text-xs font-semibold text-primary-strong">
                {t("viewKhata")}
                <ChevronRight aria-hidden className="size-3.5 rtl:-scale-x-100" />
              </span>
            </span>
          </Link>
        </div>

        {feed.trending.length > 0 ? (
          <Section title={t("sections.trending")} hint={t("sections.trendingHint")} bleed>
            <Rail>
              {feed.trending.map((item) => (
                <CatalogCard
                  key={item.distributor_product_id}
                  item={item}
                  shopId={shopId}
                  layout="rail"
                />
              ))}
            </Rail>
          </Section>
        ) : null}

        {feed.brands.length > 0 ? (
          <Section title={t("sections.brands")} bleed>
            <div className="flex scroll-px-4 scrollbar-none gap-2 overflow-x-auto px-4 pb-1">
              {feed.brands.map((brand) => (
                <Link
                  key={brand.id}
                  href={`/dukan/search?q=${encodeURIComponent(brand.name)}`}
                  className="flex h-12 shrink-0 items-center gap-2 rounded-full border border-border/80 bg-surface ps-1.5 pe-4 shadow-card"
                >
                  <Avatar className="size-9">
                    <AvatarFallback name={brand.name} />
                  </Avatar>
                  <span className="text-sm font-semibold text-ink">{localName(brand, locale)}</span>
                </Link>
              ))}
            </div>
          </Section>
        ) : null}

        {distributors.length > 0 ? (
          <Section
            title={t("sections.distributors")}
            action={{ href: "/dukan/distributors", label: tCommon("seeAll") }}
          >
            <ul className="grid gap-3 sm:grid-cols-2">
              {distributors.slice(0, 4).map((d) => (
                <li key={d.org_id}>
                  <Link
                    href={`/dukan/distributors/${d.org_id}`}
                    className="flex items-center gap-3 rounded-lg border border-border/70 bg-surface p-3 shadow-card"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-strong">
                      <Store aria-hidden className="size-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{d.name}</span>
                      <span className="num block truncate text-xs text-muted">
                        {t("products", { count: d.product_count })}
                        {" · "}
                        {t("distributors.minimum", { amount: formatRs(d.min_order_paisa) })}
                      </span>
                    </span>
                    {d.rating !== null ? (
                      <span className="num flex items-center gap-1 rounded-full bg-awning-soft px-2 py-1 text-xs font-bold text-awning-ink">
                        <Star aria-hidden className="size-3.5 fill-current" />
                        {d.rating.toFixed(1)}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </div>
      <ProductSheet shopId={shopId} />
      <DukanCartBar shopId={shopId} />
    </CartBoundary>
  );
}

/** The dukandar's ordering home: delivery promise, search, offers, categories and deals. */
export function DukanHome() {
  return (
    <Suspense fallback={<DukanHomeSkeleton />}>
      <DukanHomeContent />
    </Suspense>
  );
}
