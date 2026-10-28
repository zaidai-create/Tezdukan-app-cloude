import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { CategoryTile } from "@/components/commerce/category-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { categoryIcon, categoryTint } from "../category-style";
import { getFacets, requireDukan } from "../data";
import { storageUrl } from "../images";
import { localName } from "../labels";

function CategoriesSkeleton() {
  return (
    <div
      className="mx-auto grid w-full max-w-6xl grid-cols-3 gap-4 px-4 py-6 sm:grid-cols-4 lg:grid-cols-6"
      aria-hidden
    >
      <Skeleton className="col-span-full h-8 w-48" />
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

async function CategoriesContent() {
  await connection();
  const { shopId } = await requireDukan("/dukan/categories");
  const [facets, t, locale] = await Promise.all([
    getFacets(shopId),
    getTranslations("ordering"),
    getLocale(),
  ]);
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5">
      <h1 className="font-heading text-2xl font-extrabold text-ink lg:text-3xl">
        {t("sections.categories")}
      </h1>
      <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
        {facets.categories.map((category) => (
          <li key={category.id} className="flex flex-col items-center gap-0.5">
            <CategoryTile
              href={`/dukan/categories/${category.slug}`}
              name={localName(category, locale)}
              imageUrl={storageUrl(category.image_path)}
              icon={categoryIcon(category.slug)}
              tint={categoryTint(category.tint)}
            />
            <span className="num text-xs text-muted">
              {t("products", { count: category.product_count })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Every category the dukan can order from, with how many products each has. */
export function CategoriesIndex() {
  return (
    <Suspense fallback={<CategoriesSkeleton />}>
      <CategoriesContent />
    </Suspense>
  );
}
