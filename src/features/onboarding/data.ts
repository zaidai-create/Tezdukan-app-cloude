import "server-only";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { areaSchema, type Area } from "./schemas";

/** Hyderabad's delivery zones, for the registration forms. */
export async function getServiceAreas(): Promise<Area[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("service_areas")
    .select("id, name, name_ur, center_lat, center_lng")
    .eq("kind", "zone")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return z.array(areaSchema).parse(data);
}
