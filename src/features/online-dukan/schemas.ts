import { z } from "zod";

/** The "Online dukan" settings, as shop_storefront and update_shop_storefront return them. */
export const shopStorefrontSchema = z.object({
  shop_id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  is_approved: z.boolean(),
  is_live: z.boolean(),
  tagline: z.string().nullable(),
  eta_minutes: z.number().int(),
  min_order_paisa: z.number().int().nonnegative(),
  delivery_fee_paisa: z.number().int().nonnegative(),
  free_delivery_above_paisa: z.number().int().nonnegative().nullable(),
  delivery_radius_m: z.number().int().positive(),
  serves_all_city: z.boolean(),
  lat: z.coerce.number().nullable(),
  lng: z.coerce.number().nullable(),
  address_line: z.string().nullable(),
  visible_products: z.number().int().nonnegative(),
  can_edit: z.boolean(),
});
export type ShopStorefront = z.infer<typeof shopStorefrontSchema>;

/** How far a dukan delivers, in metres; the spec's mohalla dukans cover 1 to 5 km. */
export const radiusOptions = [1000, 2000, 3000, 4000, 5000] as const;

/** Delivery times offered as chips; a dukan's own value is added when it is not one of these. */
export const etaOptions = [15, 20, 30, 45, 60] as const;

export const storefrontTermsSchema = z.object({
  eta_minutes: z.number().int().min(5).max(240),
  min_order_paisa: z.number().int().min(0).max(10_000_000),
  delivery_fee_paisa: z.number().int().min(0).max(100_000),
  /** 0 means no free-delivery offer. */
  free_delivery_above_paisa: z.number().int().min(0).max(10_000_000),
  tagline: z.string().trim().max(120),
  delivery_radius_m: z.number().int().min(500).max(5000),
});
export type StorefrontTerms = z.infer<typeof storefrontTermsSchema>;
