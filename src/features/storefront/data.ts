import "server-only";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCustomerLocation } from "./location";
import {
  type DeliveryZone,
  deliveryZoneSchema,
  nearbyShopSchema,
  storefrontCategorySchema,
  storefrontProductSchema,
  storefrontShopSchema,
  type NearbyShop,
  type StorefrontCategory,
  type StorefrontProduct,
  type StorefrontShop,
} from "./schemas";

export async function getStorefrontCategories(): Promise<StorefrontCategory[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("storefront_categories");
  if (error) throw new Error(error.message);
  return z.array(storefrontCategorySchema).parse(data);
}

/**
 * Products the shopper can order: only from dukans that deliver to their location. Without a
 * location there is nothing to show yet (the screens ask for it first).
 */
export async function getStorefrontProducts(options: {
  categoryId?: string;
  query?: string;
  limit?: number;
}): Promise<StorefrontProduct[]> {
  const location = await getCustomerLocation();
  if (!location) return [];
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("storefront_products", {
    p_category_id: options.categoryId,
    p_query: options.query,
    p_limit: options.limit ?? 60,
    p_lat: location.lat,
    p_lng: location.lng,
  });
  if (error) throw new Error(error.message);
  // Customers only see what they can buy now.
  return z
    .array(storefrontProductSchema)
    .parse(data)
    .filter((product) => product.in_stock);
}

/** Dukans that deliver to the shopper's location, nearest first; none until there is one. */
export async function getNearbyShops(): Promise<NearbyShop[]> {
  const location = await getCustomerLocation();
  if (!location) return [];
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("nearby_dukans", {
    p_limit: 30,
    p_lat: location.lat,
    p_lng: location.lng,
  });
  if (error) throw new Error(error.message);
  return z.array(nearbyShopSchema).parse(data);
}

export async function getDeliveryZones(): Promise<DeliveryZone[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("delivery_zones");
  if (error) throw new Error(error.message);
  return z.array(deliveryZoneSchema).parse(data);
}

export async function getStorefrontShop(slug: string): Promise<StorefrontShop | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("storefront_shop", { p_slug: slug });
  if (error) throw new Error(error.message);
  if (data === null) return null;
  const shop = storefrontShopSchema.parse(data);
  return { ...shop, products: shop.products.filter((product) => product.in_stock) };
}

/**
 * Whether a dukan delivers to the shopper's delivery point. True while no point is chosen:
 * there is nothing to refuse yet, and checkout asks for the address.
 */
export async function shopDeliversHere(shopId: string): Promise<boolean> {
  const location = await getCustomerLocation();
  if (!location) return true;
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("shop_delivers_to", {
    p_shop_id: shopId,
    p_lat: location.lat,
    p_lng: location.lng,
  });
  if (error) throw new Error(error.message);
  return data !== false;
}

/** Products the shopper ordered before that nearby dukans still have, most ordered first. */
export async function getBuyAgain(limit = 12): Promise<StorefrontProduct[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_buy_again", { p_limit: limit });
  if (error) throw new Error(error.message);
  return z.array(storefrontProductSchema).parse(data);
}
