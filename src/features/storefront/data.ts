import "server-only";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
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

export async function getStorefrontProducts(options: {
  categoryId?: string;
  query?: string;
  limit?: number;
}): Promise<StorefrontProduct[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("storefront_products", {
    p_category_id: options.categoryId,
    p_query: options.query,
    p_limit: options.limit ?? 60,
  });
  if (error) throw new Error(error.message);
  // Customers only see what they can buy now.
  return z
    .array(storefrontProductSchema)
    .parse(data)
    .filter((product) => product.in_stock);
}

export async function getNearbyShops(): Promise<NearbyShop[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("nearby_dukans", { p_limit: 30 });
  if (error) throw new Error(error.message);
  return z.array(nearbyShopSchema).parse(data);
}

export async function getStorefrontShop(slug: string): Promise<StorefrontShop | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("storefront_shop", { p_slug: slug });
  if (error) throw new Error(error.message);
  if (data === null) return null;
  const shop = storefrontShopSchema.parse(data);
  return { ...shop, products: shop.products.filter((product) => product.in_stock) };
}

/** Products the shopper ordered before that nearby dukans still have, most ordered first. */
export async function getBuyAgain(limit = 12): Promise<StorefrontProduct[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_buy_again", { p_limit: limit });
  if (error) throw new Error(error.message);
  return z.array(storefrontProductSchema).parse(data);
}
