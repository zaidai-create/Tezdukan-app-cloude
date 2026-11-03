"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireDukan } from "@/features/ordering/data";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  addItemsSchema,
  addResultSchema,
  masterMatchSchema,
  updateProductSchema,
  type AddItem,
  type MasterMatch,
  type UpdateProduct,
} from "./schemas";

/** Product writes for the dukandar's active dukan; the dukan always comes from the session. */

export type ProductsError = "generic" | "not_allowed" | "invalid";
export type ProductsResult<T> = { ok: true; data: T } | { ok: false; error: ProductsError };

function errorKey(message: string | undefined): ProductsError {
  if (message === "not_allowed") return "not_allowed";
  if (message === "invalid_items" || message === "invalid_qty") return "invalid";
  return "generic";
}

export async function addProducts(
  items: AddItem[],
): Promise<ProductsResult<{ added: number; updated: number }>> {
  const parsed = addItemsSchema.safeParse(items);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { shopId } = await requireDukan("/dukan/products");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("add_shop_products", {
    p_shop_id: shopId,
    p_items: parsed.data,
  });
  if (error) return { ok: false, error: errorKey(error.message) };
  const result = addResultSchema.safeParse(data);
  if (!result.success) return { ok: false, error: "generic" };
  refresh();
  return { ok: true, data: result.data };
}

export async function updateProduct(input: UpdateProduct): Promise<ProductsResult<null>> {
  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { shopId } = await requireDukan("/dukan/products");
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("shop_inventory")
    .update({
      selling_price_paisa: parsed.data.selling_price_paisa,
      is_visible_online: parsed.data.is_visible_online,
    })
    .eq("id", parsed.data.id)
    .eq("shop_id", shopId);
  if (error) return { ok: false, error: errorKey(error.message) };
  const stock = await supabase.rpc("set_shop_stock", {
    p_inventory_id: parsed.data.id,
    p_qty: parsed.data.qty,
  });
  if (stock.error) return { ok: false, error: errorKey(stock.error.message) };
  refresh();
  return { ok: true, data: null };
}

/** Takes a product off the shelf list (kept for past bills and orders). */
export async function removeProduct(id: string): Promise<ProductsResult<null>> {
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) return { ok: false, error: "invalid" };
  const { shopId } = await requireDukan("/dukan/products");
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("shop_inventory")
    .update({ is_active: false })
    .eq("id", parsedId.data)
    .eq("shop_id", shopId);
  if (error) return { ok: false, error: errorKey(error.message) };
  refresh();
  return { ok: true, data: null };
}

export async function searchCatalog(query: string): Promise<MasterMatch[]> {
  const q = z.string().trim().max(80).catch("").parse(query);
  if (q.length < 2) return [];
  await requireDukan("/dukan/products");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("search_master_products", { p_query: q, p_limit: 12 });
  if (error) return [];
  const parsed = masterMatchSchema.safeParse(data);
  return parsed.success ? parsed.data : [];
}
