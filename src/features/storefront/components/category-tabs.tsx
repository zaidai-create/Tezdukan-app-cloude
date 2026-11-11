import { cn } from "cn";
import { Package, ShoppingBasket } from "lucide-react";
import { categoryIcon } from "@/features/ordering/category-style";
import { Link } from "@/i18n/navigation";
import type { StorefrontCategory } from "../schemas";
import { RevealInRow } from "./reveal-in-row";

/**
 * The aisles as a row of icon tabs that stays under the search field while the shelf scrolls:
 * "All" is the home feed, every other tab is one category. The line under a tab marks where
 * the shopper is.
 */
export function CategoryTabs({
  categories,
  activeId,
  locale,
  label,
  allLabel,
}: {
  categories: StorefrontCategory[];
  /** The category shown now; null for the home feed ("All"). */
  activeId: string | null;
  locale: string;
  label: string;
  allLabel: string;
}) {
  const urdu = locale === "ur" || locale === "sd";
  const tab = (active: boolean) =>
    cn(
      "relative flex min-w-[4.25rem] flex-col items-center gap-1 px-2.5 pt-2 pb-2.5 text-xs whitespace-nowrap transition-colors",
      "after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t-full after:transition-colors",
      active
        ? "font-bold text-ink after:bg-primary"
        : "font-semibold text-muted after:bg-transparent",
    );
  return (
    <nav
      aria-label={label}
      className="sticky top-[calc(3.75rem+env(safe-area-inset-top))] z-20 -mx-4 border-b border-border/70 bg-canvas/95 backdrop-blur"
    >
      <ul className="flex snap-x scroll-px-2 [scrollbar-width:none] overflow-x-auto px-2">
        <li className="shrink-0 snap-start">
          <Link
            href="/"
            className={tab(activeId === null)}
            aria-current={activeId === null ? "page" : undefined}
          >
            <ShoppingBasket aria-hidden className="size-6" strokeWidth={1.75} />
            {allLabel}
          </Link>
        </li>
        {categories.map((category) => {
          const Icon = categoryIcon(category.slug) ?? Package;
          const active = category.id === activeId;
          return (
            <li key={category.id} className="shrink-0 snap-start">
              <Link
                href={`/categories?c=${category.id}`}
                className={tab(active)}
                aria-current={active ? "page" : undefined}
              >
                <Icon aria-hidden className="size-6" strokeWidth={1.75} />
                {urdu && category.name_ur ? category.name_ur : category.name}
              </Link>
              {active ? <RevealInRow /> : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
