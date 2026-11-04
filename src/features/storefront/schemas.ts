import { z } from "zod";

export const storefrontProductSchema = z.object({
  id: z.uuid(),
  shop_id: z.uuid(),
  shop_name: z.string(),
  shop_slug: z.string(),
  name: z.string(),
  name_ur: z.string().nullable(),
  pack_size_label: z.string().nullable(),
  unit: z.string(),
  is_loose: z.boolean(),
  selling_price_paisa: z.number().int().nonnegative(),
  mrp_paisa: z.number().int().nonnegative().nullable(),
  category_id: z.uuid().nullable(),
  is_favourite: z.boolean(),
  in_stock: z.boolean(),
  low_stock: z.boolean(),
  image_path: z.string().nullable(),
});
export type StorefrontProduct = z.infer<typeof storefrontProductSchema>;

export const storefrontCategorySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  name_ur: z.string().nullable(),
  slug: z.string(),
  image_path: z.string().nullable(),
  tint: z.string().nullable(),
  sort_order: z.number(),
  product_count: z.number().int(),
});
export type StorefrontCategory = z.infer<typeof storefrontCategorySchema>;

/** A dukan's delivery terms, as nearby_dukans and storefront_shop return them. */
const shopTerms = {
  is_live: z.boolean(),
  tagline: z.string().nullable(),
  eta_minutes: z.number().int().nullable(),
  min_order_paisa: z.number().int().nonnegative(),
  delivery_fee_paisa: z.number().int().nonnegative(),
  free_delivery_above_paisa: z.number().int().nonnegative().nullable(),
  /** Average stars from delivered orders, one decimal; null until the first rating. */
  rating: z.number().min(1).max(5).nullable(),
  rating_count: z.number().int().nonnegative(),
};

export const shopReviewSchema = z.object({
  id: z.uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string(),
  created_at: z.string(),
});
export type ShopReview = z.infer<typeof shopReviewSchema>;

export const storefrontShopSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  address_line: z.string().nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  photo_path: z.string().nullable(),
  area_name: z.string().nullable(),
  area_name_ur: z.string().nullable(),
  pickup_enabled: z.boolean(),
  reviews: z.array(shopReviewSchema),
  products: z.array(storefrontProductSchema),
  ...shopTerms,
});
export type StorefrontShop = z.infer<typeof storefrontShopSchema>;

export const nearbyShopSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  address_line: z.string().nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  photo_path: z.string().nullable(),
  area_name: z.string().nullable(),
  area_name_ur: z.string().nullable(),
  distance_m: z.number().nullable(),
  ...shopTerms,
});
export type NearbyShop = z.infer<typeof nearbyShopSchema>;
