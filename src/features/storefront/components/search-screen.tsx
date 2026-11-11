"use client";

import { ArrowLeft, Clock3, PackageSearch, Search, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { z } from "zod";
import { CategoryTile } from "@/components/commerce/category-tile";
import { EmptyState } from "@/components/states/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { categoryIcon, categoryTint } from "@/features/ordering/category-style";
import { storageUrl } from "@/features/ordering/images";
import { Link } from "@/i18n/navigation";
import { useProductSearch } from "../queries";
import type { StorefrontBrand, StorefrontCategory } from "../schemas";
import { ProductGrid } from "./product-grid";

const RECENT_KEY = "td-recent-searches";
const RECENT_MAX = 8;
const TYPING_PAUSE_MS = 280;

function readRecent(): string[] {
  try {
    return z
      .array(z.string().min(2).max(80))
      .max(RECENT_MAX)
      .catch([])
      .parse(JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

/** What this phone searched for lately, newest first (kept on the phone only). */
function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    // The list lives in the phone's storage, which the server cannot see.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(readRecent());
  }, []);
  const save = (next: string[]) => {
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // Storage is full or blocked: the list simply is not remembered.
    }
  };
  return {
    recent,
    remember: (query: string) => {
      const text = query.trim();
      if (text.length < 2) return;
      const rest = recent.filter((item) => item.toLowerCase() !== text.toLowerCase());
      save([text, ...rest].slice(0, RECENT_MAX));
    },
    clear: () => save([]),
  };
}

/**
 * Search as a screen of its own: the field is focused at once, results appear while typing
 * (spelling mistakes and Roman Urdu are understood), and before any typing the shopper sees
 * what they searched lately, the categories and the popular brands.
 */
export function SearchScreen({
  categories,
  brands,
  initialQuery,
}: {
  categories: StorefrontCategory[];
  brands: StorefrontBrand[];
  initialQuery: string;
}) {
  const t = useTranslations("storefront");
  const locale = useLocale();
  const urdu = locale === "ur" || locale === "sd";
  const [query, setQuery] = useState(initialQuery);
  const [typed, setTyped] = useState(initialQuery);
  const { recent, remember, clear } = useRecentSearches();
  const search = useProductSearch(typed);
  const products = search.data ?? [];
  const asking = typed.trim().length >= 2;

  useEffect(() => {
    const timer = setTimeout(() => setTyped(query), TYPING_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pb-6">
      <form
        role="search"
        className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-20 -mx-4 flex items-center gap-2 bg-canvas/95 px-4 py-2.5 backdrop-blur"
        onSubmit={(event) => {
          event.preventDefault();
          setTyped(query);
          remember(query);
        }}
      >
        <Link
          href="/"
          aria-label={t("search.back")}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-card"
        >
          <ArrowLeft aria-hidden className="size-5 rtl:-scale-x-100" strokeWidth={1.75} />
        </Link>
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-primary"
            strokeWidth={1.75}
          />
          <input
            type="search"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value.slice(0, 80))}
            placeholder={t("search.placeholder")}
            aria-label={t("searchLabel")}
            // The whole screen exists to type into this field.
            autoFocus
            enterKeyHint="search"
            autoComplete="off"
            dir="auto"
            className="h-12 w-full rounded-full border border-border bg-surface ps-12 pe-12 text-base text-ink shadow-card outline-none placeholder:text-muted focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setTyped("");
              }}
              aria-label={t("search.clear")}
              className="absolute end-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-muted active:bg-subtle"
            >
              <X aria-hidden className="size-5" strokeWidth={1.75} />
            </button>
          ) : null}
        </div>
      </form>

      {asking ? (
        search.isPending ? (
          <div
            className="grid grid-cols-3 gap-x-2.5 gap-y-5 sm:grid-cols-4 lg:grid-cols-6"
            aria-hidden
          >
            {Array.from({ length: 9 }, (_, index) => (
              <div key={index} className="flex flex-col gap-2">
                <Skeleton className="aspect-square rounded-2xl" />
                <Skeleton className="h-4 w-16 rounded-sm" />
                <Skeleton className="h-4 w-full rounded-sm" />
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <section className="flex flex-col gap-3">
            <p className="num text-sm font-semibold text-muted" role="status">
              {t("search.results", { count: products.length })}
            </p>
            <ProductGrid products={products} onOpenProduct={() => remember(typed)} />
          </section>
        ) : (
          <EmptyState
            icon={PackageSearch}
            title={t("search.empty", { query: typed.trim() })}
            description={t("search.emptyHint")}
          />
        )
      ) : (
        <>
          {recent.length > 0 ? (
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-heading text-lg font-bold text-ink">{t("search.recent")}</h2>
                <button
                  type="button"
                  onClick={clear}
                  className="inline-flex min-h-11 items-center px-1 text-sm font-semibold text-primary"
                >
                  {t("search.clearRecent")}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recent.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setQuery(item);
                      setTyped(item);
                    }}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-sm font-semibold text-ink"
                  >
                    <Clock3 aria-hidden className="size-4 text-muted" strokeWidth={1.75} />
                    <span dir="auto">{item}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {categories.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="font-heading text-lg font-bold text-ink">{t("search.browse")}</h2>
              <div className="grid grid-cols-4 gap-x-3 gap-y-4 sm:grid-cols-6 lg:grid-cols-8">
                {categories.map((category) => (
                  <CategoryTile
                    key={category.id}
                    href={`/categories?c=${category.id}`}
                    name={urdu && category.name_ur ? category.name_ur : category.name}
                    imageUrl={storageUrl(category.image_path)}
                    icon={categoryIcon(category.slug)}
                    tint={categoryTint(category.tint)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {brands.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="font-heading text-lg font-bold text-ink">{t("search.brands")}</h2>
              <div className="flex flex-wrap gap-2">
                {brands.slice(0, 16).map((brand) => (
                  <Link
                    key={brand.id}
                    href={`/categories?brand=${brand.id}`}
                    className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-semibold text-ink"
                  >
                    {urdu && brand.name_ur ? brand.name_ur : brand.name}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
