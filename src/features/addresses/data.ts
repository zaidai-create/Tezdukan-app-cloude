import "server-only";
import { cache } from "react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ADDRESS_COLUMNS, addressSchema, type SavedAddress } from "./schemas";

/**
 * The signed-in person's saved addresses, the default first (RLS: own rows only). Several
 * parts of one screen ask for them, so the answer is shared within a request.
 */
export const getMyAddresses = cache(async (): Promise<SavedAddress[]> => {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("addresses")
    .select(ADDRESS_COLUMNS)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return addressSchema.array().parse(data);
});
