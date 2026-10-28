import {
  Coffee,
  Cookie,
  CupSoda,
  Droplet,
  Flame,
  GlassWater,
  type LucideIcon,
  Milk,
  Popcorn,
  ShowerHead,
  Smile,
  Soup,
  SprayCan,
  Wheat,
} from "lucide-react";
import type { CategoryTint } from "@/components/commerce/category-tile";

/** Icons for category tiles without a photo, by category slug. */
const icons: Record<string, LucideIcon> = {
  "tea-coffee": Coffee,
  dairy: Milk,
  "cooking-oil-ghee": Droplet,
  "atta-rice-sugar": Wheat,
  "spices-salt": Flame,
  "noodles-sauces": Soup,
  biscuits: Cookie,
  snacks: Popcorn,
  beverages: CupSoda,
  water: GlassWater,
  detergents: SprayCan,
  soaps: ShowerHead,
  "oral-care": Smile,
};

export function categoryIcon(slug: string): LucideIcon | undefined {
  return icons[slug];
}

/** Categories store a design-token name ("mint", "awning"); tiles use soft tints. */
export function categoryTint(tint: string | null): CategoryTint {
  if (tint === "awning") return "amber";
  if (tint === "peach" || tint === "teal" || tint === "sand" || tint === "sky") return tint;
  return "green";
}
