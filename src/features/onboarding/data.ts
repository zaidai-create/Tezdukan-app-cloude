import "server-only";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { areaSchema, nearbyDukanSchema, type Area, type NearbyDukan } from "./schemas";

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

export async function getNearbyDukans(): Promise<NearbyDukan[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("nearby_dukans", { p_limit: 20 });
  if (error) throw new Error(error.message);
  return z.array(nearbyDukanSchema).parse(data);
}
