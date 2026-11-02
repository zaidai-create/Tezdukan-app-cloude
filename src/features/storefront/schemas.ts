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
};

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
