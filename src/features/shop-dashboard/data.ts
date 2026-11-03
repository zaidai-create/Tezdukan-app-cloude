import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { shopDashboardSchema, type ShopDashboard } from "./schemas";

export async function getShopDashboard(shopId: string): Promise<ShopDashboard> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("shop_dashboard", { p_shop_id: shopId });
  if (error) throw new Error(error.message);
  return shopDashboardSchema.parse(data);
}
