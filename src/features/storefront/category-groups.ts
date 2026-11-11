import type { StorefrontCategory } from "./schemas";

/**
 * The aisles of the store: categories gathered under a few headings a shopper already knows,
 * so the Categories screen reads like a store's signs and not one long list. A category that
 * is not listed here (one the team adds later) falls under "More".
 */
export const categoryGroups = [
  {
    key: "kitchen",
    slugs: ["atta-rice-sugar", "cooking-oil-ghee", "spices-salt", "dairy", "noodles-sauces"],
  },
  { key: "snacks", slugs: ["tea-coffee", "biscuits", "snacks", "beverages", "water"] },
  { key: "home", slugs: ["detergents", "soaps", "oral-care"] },
] as const;

export type CategoryGroupKey = (typeof categoryGroups)[number]["key"] | "more";

/** Categories under their aisle, in the aisle's own order; empty aisles are left out. */
export function groupCategories(
  categories: StorefrontCategory[],
): { key: CategoryGroupKey; categories: StorefrontCategory[] }[] {
  const placed = new Set<string>();
  const groups: { key: CategoryGroupKey; categories: StorefrontCategory[] }[] = categoryGroups.map(
    (group) => ({
      key: group.key,
      categories: group.slugs.flatMap((slug) => {
        const match = categories.find((category) => category.slug === slug);
        if (!match) return [];
        placed.add(match.id);
        return [match];
      }),
    }),
  );
  const rest = categories.filter((category) => !placed.has(category.id));
  if (rest.length > 0) groups.push({ key: "more", categories: rest });
  return groups.filter((group) => group.categories.length > 0);
}
