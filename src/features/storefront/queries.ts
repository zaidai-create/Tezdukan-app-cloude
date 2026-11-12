"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { LOCATION_COOKIE, parseLocation } from "./location-cookie";
import {
  productDetailSchema,
  storefrontProductSchema,
  storefrontShopSchema,
  type ProductDetail,
  type StorefrontProduct,
} from "./schemas";

/**
 * The shopper's delivery point as the phone knows it (the same cookie the server reads).
 * A saved address's own pin wins on the server; here the cookie copy is close enough to pick
 * which dukans' products to show.
 */
export function readDeliveryPoint(): { lat: number; lng: number } | null {
  if (typeof document === "undefined") return null;
  const entry = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${LOCATION_COOKIE}=`));
  return parseLocation(entry?.slice(LOCATION_COOKIE.length + 1));
}

async function fetchProductDetail(id: string): Promise<ProductDetail | null> {
  const point = readDeliveryPoint();
  const { data, error } = await getSupabaseBrowserClient().rpc("storefront_product", {
    p_id: id,
    p_lat: point?.lat,
    p_lng: point?.lng,
  });
  if (error) throw new Error(error.message);
  return data === null ? null : productDetailSchema.parse(data);
}

/** One product up close: photos, sizes, the dukan's terms and similar products. */
export function useProductDetail(id: string | null) {
  return useQuery({
    queryKey: ["storefront", "product", id],
    queryFn: () => fetchProductDetail(id ?? ""),
    enabled: id !== null,
    staleTime: 60_000,
  });
}

async function searchProducts(query: string): Promise<StorefrontProduct[]> {
  const point = readDeliveryPoint();
  if (!point) return [];
  const { data, error } = await getSupabaseBrowserClient().rpc("storefront_products", {
    p_query: query,
    p_sort: "relevance",
    p_limit: 30,
    p_lat: point.lat,
    p_lng: point.lng,
  });
  if (error) throw new Error(error.message);
  return z
    .array(storefrontProductSchema)
    .parse(data)
    .filter((product) => product.in_stock);
}

/** Products matching what is typed, from dukans that deliver to the shopper. */
export function useProductSearch(query: string) {
  const text = query.trim();
  return useQuery({
    queryKey: ["storefront", "search", text],
    queryFn: () => searchProducts(text),
    enabled: text.length >= 2,
    staleTime: 30_000,
    // Keep the last results on screen while the next letters are looked up.
    placeholderData: keepPreviousData,
  });
}

const shopProductsSchema = storefrontShopSchema.pick({ products: true });

async function fetchShopProducts(slug: string): Promise<StorefrontProduct[]> {
  const { data, error } = await getSupabaseBrowserClient().rpc("storefront_shop", { p_slug: slug });
  if (error) throw new Error(error.message);
  if (data === null) return [];
  return shopProductsSchema.parse(data).products.filter((product) => product.in_stock);
}

/** One dukan's shelf (in stock), for "Did you forget?" at checkout. */
export function useShopProducts(slug: string) {
  return useQuery({
    queryKey: ["storefront", "shop-products", slug],
    queryFn: () => fetchShopProducts(slug),
    staleTime: 5 * 60_000,
  });
}
