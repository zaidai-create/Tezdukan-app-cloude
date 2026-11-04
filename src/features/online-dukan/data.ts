import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { type ShopStorefront, shopStorefrontSchema } from "./schemas";

export async function getShopStorefront(shopId: string): Promise<ShopStorefront> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("shop_storefront", { p_shop_id: shopId });
  if (error) throw new Error(error.message);
  return shopStorefrontSchema.parse(data);
}
