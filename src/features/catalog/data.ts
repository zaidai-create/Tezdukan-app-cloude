import "server-only";
import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { orgCatalogSchema, referenceSchema, type CatalogFilter } from "./schemas";

/** Server-side catalog reads, as the signed-in distributor member. */

export async function getOrgCatalog(orgId: string, filter: CatalogFilter, query?: string) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("org_catalog", {
    p_org_id: orgId,
    p_filter: filter,
    p_query: query || undefined,
    p_limit: 300,
  });
  if (error) throw new Error(error.message);
  return orgCatalogSchema.parse(data);
}

export async function getCatalogProduct(orgId: string, productId: string) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("org_catalog", { p_org_id: orgId, p_limit: 500 });
  if (error) throw new Error(error.message);
  const product = orgCatalogSchema.parse(data).items.find((item) => item.id === productId);
  if (!product) notFound();
  return product;
}

/** Brands and categories for the form's pickers (public reference data). */
export async function getCatalogReference() {
  const supabase = await getSupabaseServerClient();
  const [brands, categories] = await Promise.all([
    supabase.from("brands").select("id, name").eq("is_active", true).order("name"),
    supabase.from("categories").select("id, slug, name").eq("is_active", true).order("sort_order"),
  ]);
  if (brands.error) throw new Error(brands.error.message);
  if (categories.error) throw new Error(categories.error.message);
  return referenceSchema.parse({ brands: brands.data, categories: categories.data });
}
