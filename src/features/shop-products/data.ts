import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { shopProductsSchema, starterPackSchema } from "./schemas";

/** The dukan's products on the shelf (RLS: staff with inventory, billing or orders access). */
export async function getShopProducts(shopId: string) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("shop_inventory")
    .select(
      "id, name, name_ur, pack_size_label, image_path, selling_price_paisa, mrp_paisa, qty_on_hand, low_stock_threshold, is_visible_online, is_loose",
    )
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .order("name")
    .limit(1000);
  if (error) throw new Error(error.message);
  return shopProductsSchema.parse(data);
}

/** Common products the dukan does not stock yet, for one-tap adding. */
export async function getStarterPack(shopId: string) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("shop_starter_pack", {
    p_shop_id: shopId,
    p_limit: 16,
  });
  if (error) throw new Error(error.message);
  return starterPackSchema.parse(data);
}
