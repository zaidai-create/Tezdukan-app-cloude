"use client";

import { ArrowLeft, History, Mic, Search, SearchX, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CategoryTile } from "@/components/commerce/category-tile";
import { useMunshi } from "@/components/munshi/munshi-store";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { ProductGridSkeleton } from "@/components/states/skeletons";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { categoryIcon, categoryTint } from "../category-style";
import { CatalogCard } from "../components/catalog-card";
import { storageUrl } from "../images";
import { localName } from "../labels";
import { useCatalogSearch } from "../queries";
import type { BrandFacet, CategoryFacet } from "../schemas";

const RECENT_KEY = "td_recent_searches";
const EMPTY: string[] = [];
const listeners = new Set<() => void>();
let cache: { raw: string | null; list: string[] } = { raw: null, list: EMPTY };

// Recent searches live in this browser only (localStorage), read through a tiny external store.
function readRecent(): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(RECENT_KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cache.raw) return cache.list;
  let list = EMPTY;
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    if (Array.isArray(value))
      list = value.filter((v): v is string => typeof v === "string").slice(0, 8);
  } catch {
    list = EMPTY;
  }
  cache = { raw, list };
  return list;
}

function writeRecent(list: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
  } catch {
    // Storage unavailable (private mode): recent searches just won't be kept.
  }
  for (const listener of listeners) listener();
}

function useRecentSearches(): string[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    readRecent,
    () => EMPTY,
  );
}

/**
 * Instant product search: results as you type (typos, Urdu, Roman Urdu and barcodes work),
 * recent searches, categories and brands to start from, and Munshi for asking by voice.
 */
function SearchScreen({
  shopId,
  initialQuery,
  categories,
  brands,
}: {
  shopId: string;
  initialQuery: string;
  categories: CategoryFacet[];
  brands: BrandFacet[];
}) {
  const t = useTranslations("ordering");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const openMunshi = useMunshi((s) => s.openMunshi);
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const recent = useRecentSearches();
  const search = useCatalogSearch(shopId, query);

  // Search a moment after typing stops; keep the query in the URL for back and sharing.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = text.trim();
      setQuery(next);
      router.replace(next ? `${pathname}?q=${encodeURIComponent(next)}` : pathname, {
        scroll: false,
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [text, pathname, router]);

  // Remember a search once it found something.
  useEffect(() => {
    if (query.length < 2 || !search.data?.length) return;
    const current = readRecent();
    if (current[0]?.toLowerCase() === query.toLowerCase()) return;
    writeRecent([query, ...current.filter((q) => q.toLowerCase() !== query.toLowerCase())]);
  }, [query, search.data]);

  const choose = (value: string) => {
    setText(value);
    input.current?.focus();
  };
  const active = query.length >= 2;
  const results = search.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 pb-4">
      <div className="material sticky top-[calc(var(--safe-top)+4rem)] z-20 flex items-center gap-2 border-b border-border/60 px-4 py-3 lg:top-16">
        <Link
          href="/dukan"
          aria-label={tCommon("back")}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-subtle"
        >
          <ArrowLeft aria-hidden className="size-5 rtl:-scale-x-100" />
        </Link>
        <label className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full border border-border-strong/40 bg-surface ps-4 pe-1.5 shadow-card focus-within:border-primary">
          <Search aria-hidden className="size-5 shrink-0 text-muted" />
          <span className="sr-only">{t("searchLabel")}</span>
          <input
            ref={input}
            type="search"
            enterKeyHint="search"
            autoFocus
            autoComplete="off"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:appearance-none"
          />
          {text ? (
            <button
              type="button"
              onClick={() => choose("")}
              aria-label={t("clearRecent")}
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-subtle"
            >
              <X aria-hidden className="size-4" />
            </button>
          ) : null}
        </label>
        <button
          type="button"
          onClick={() => openMunshi({ listen: true })}
          aria-label={t("askMunshi")}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-action text-on-action shadow-glow"
        >
          <Mic aria-hidden className="size-5" />
        </button>
      </div>

      {active ? (
        search.isError ? (
          <ErrorState onRetry={() => void search.refetch()} retrying={search.isFetching} />
        ) : search.isPending ? (
          <ProductGridSkeleton count={4} className="px-4" />
        ) : results.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={t("searchEmptyTitle", { query })}
            description={t("searchEmptyHint")}
            action={
              <button
                type="button"
                onClick={() => openMunshi({ draft: query })}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary-soft px-5 font-semibold text-primary-strong"
              >
                <Mic aria-hidden className="size-5" />
                {t("askMunshi")}
              </button>
            }
          />
        ) : (
          <section className="flex flex-col gap-3 px-4">
            <p className="num text-sm text-muted" aria-live="polite">
              {t("results", { count: results.length })}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {results.map((item, index) => (
                <CatalogCard
                  key={item.distributor_product_id}
                  item={item}
                  shopId={shopId}
                  priorityImage={index < 4}
                />
              ))}
            </div>
          </section>
        )
      ) : (
        <div className="flex flex-col gap-6">
          {recent.length > 0 ? (
            <section className="flex flex-col gap-2 px-4">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-base font-bold text-ink">{t("recentSearches")}</h2>
                <button
                  type="button"
                  onClick={() => writeRecent([])}
                  className="text-sm font-semibold text-primary-strong"
                >
                  {t("clearRecent")}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recent.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => choose(value)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-sm font-semibold text-ink"
                  >
                    <History aria-hidden className="size-4 text-muted" />
                    {value}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {brands.length > 0 ? (
            <section className="flex flex-col gap-2 px-4">
              <h2 className="font-heading text-base font-bold text-ink">{t("popularSearches")}</h2>
              <div className="flex flex-wrap gap-2">
                {brands.map((brand) => (
                  <button
                    key={brand.id}
                    type="button"
                    onClick={() => choose(brand.name)}
                    className="inline-flex h-10 items-center rounded-full border border-border bg-surface px-4 text-sm font-semibold text-ink"
                  >
                    {localName(brand, locale)}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="flex flex-col gap-3 px-4">
            <h2 className="font-heading text-base font-bold text-ink">
              {t("sections.categories")}
            </h2>
            <div className="grid grid-cols-4 gap-x-3 gap-y-4 sm:grid-cols-6 lg:grid-cols-8">
              {categories.map((category) => (
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
          </section>
        </div>
      )}
    </div>
  );
}

export { SearchScreen };
