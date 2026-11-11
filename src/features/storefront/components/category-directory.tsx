import { getTranslations } from "next-intl/server";
import { CategoryTile } from "@/components/commerce/category-tile";
import { categoryIcon, categoryTint } from "@/features/ordering/category-style";
import { storageUrl } from "@/features/ordering/images";
import { groupCategories } from "../category-groups";
import type { StorefrontCategory } from "../schemas";

/**
 * Every category under its aisle heading ("Grocery & Kitchen", "Snacks & Drinks"), as big
 * photo tiles four across: the Categories tab, read like the signs in a store.
 */
export async function CategoryDirectory({
  categories,
  locale,
}: {
  categories: StorefrontCategory[];
  locale: string;
}) {
  const t = await getTranslations("storefront.groups");
  const urdu = locale === "ur" || locale === "sd";
  return (
    <div className="flex flex-col gap-7">
      {groupCategories(categories).map((group) => (
        <section key={group.key} className="flex flex-col gap-3">
          <h2 className="font-heading text-xl font-bold text-ink">{t(group.key)}</h2>
          <div className="grid grid-cols-4 gap-x-3 gap-y-4 sm:grid-cols-6 lg:grid-cols-8">
            {group.categories.map((category) => (
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
      ))}
    </div>
  );
}
