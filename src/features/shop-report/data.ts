import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { salesReportSchema, type ReportRange, type SalesReport } from "./schemas";

/** The dukan's sales report, or null when this person may not see reports (staff without access). */
export async function getSalesReport(
  shopId: string,
  range: ReportRange,
): Promise<SalesReport | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("shop_sales_report", {
    p_shop_id: shopId,
    p_range: range,
  });
  if (error) {
    if (error.message === "not_allowed") return null;
    throw new Error(error.message);
  }
  return salesReportSchema.parse(data);
}
