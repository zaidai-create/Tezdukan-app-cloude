import "server-only";
import { cache } from "react";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCustomerLocation } from "./location";
import {
  type DeliveryZone,
  deliveryZoneSchema,
  nearbyShopSchema,
  type ProductSort,
  storefrontBrandSchema,
  storefrontCategorySchema,
  storefrontProductSchema,
  storefrontShopSchema,
  type NearbyShop,
  type StorefrontBrand,
  type StorefrontCategory,
  type StorefrontProduct,
  type StorefrontShop,
} from "./schemas";

/** Categories with how many products can be delivered to the shopper right now. */
export async function getStorefrontCategories(): Promise<StorefrontCategory[]> {
  const location = await getCustomerLocation();
  const supabase = await getSupabaseServerClient();
  // With a delivery point the counts are of what can be delivered there.
  const { data, error } = location
    ? await supabase.rpc("storefront_categories", { p_lat: location.lat, p_lng: location.lng })
    : await supabase.rpc("storefront_categories");
  if (error) throw new Error(error.message);
  return z.array(storefrontCategorySchema).parse(data);
}

/** Brands with something in stock that can be delivered to the shopper. */
export async function getStorefrontBrands(): Promise<StorefrontBrand[]> {
  const location = await getCustomerLocation();
  if (!location) return [];
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("storefront_brands", {
    p_lat: location.lat,
    p_lng: location.lng,
  });
  if (error) throw new Error(error.message);
  return z.array(storefrontBrandSchema).parse(data);
}

/**
 * Products the shopper can order: only from dukans that deliver to their location. Without a
 * location there is nothing to show yet (the screens ask for it first).
 */
export async function getStorefrontProducts(options: {
  categoryId?: string;
  brandId?: string;
  query?: string;
  sort?: ProductSort;
  limit?: number;
}): Promise<StorefrontProduct[]> {
  const location = await getCustomerLocation();
  if (!location) return [];
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("storefront_products", {
    p_category_id: options.categoryId,
    p_brand_id: options.brandId,
    p_query: options.query,
    p_sort: options.sort ?? "relevance",
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

/**
 * Dukans that deliver to the shopper's location, nearest first; none until there is one. The
 * top bar and the page both ask, so the answer is shared within a request.
 */
export const getNearbyShops = cache(async (): Promise<NearbyShop[]> => {
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
});

export const getDeliveryZones = cache(async (): Promise<DeliveryZone[]> => {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("delivery_zones");
  if (error) throw new Error(error.message);
  return z.array(deliveryZoneSchema).parse(data);
});

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
  const location = await getCustomerLocation();
  if (!location) return [];
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_buy_again", {
    p_limit: limit,
    p_lat: location.lat,
    p_lng: location.lng,
  });
  if (error) throw new Error(error.message);
  return z.array(storefrontProductSchema).parse(data);
}
