import { describe, expect, it } from "vitest";
import { groupCategories } from "./category-groups";
import type { StorefrontCategory } from "./schemas";

const category = (slug: string, index: number): StorefrontCategory => ({
  id: `00000000-0000-4000-8000-0000000000${String(index).padStart(2, "0")}`,
  name: slug,
  name_ur: null,
  slug,
  image_path: null,
  tint: null,
  sort_order: index,
  product_count: 3,
});

describe("category aisles", () => {
  it("gathers categories under their aisle, in the aisle's order", () => {
    const groups = groupCategories(
      ["snacks", "dairy", "soaps", "atta-rice-sugar", "tea-coffee"].map(category),
    );
    expect(groups.map((group) => group.key)).toEqual(["kitchen", "snacks", "home"]);
    expect(groups[0]?.categories.map((item) => item.slug)).toEqual(["atta-rice-sugar", "dairy"]);
    expect(groups[1]?.categories.map((item) => item.slug)).toEqual(["tea-coffee", "snacks"]);
  });

  it("puts a category nobody listed under More, and drops empty aisles", () => {
    const groups = groupCategories(["frozen-food", "dairy"].map(category));
    expect(groups.map((group) => group.key)).toEqual(["kitchen", "more"]);
    expect(groups[1]?.categories.map((item) => item.slug)).toEqual(["frozen-food"]);
  });
});
