"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  ADDRESS_COLUMNS,
  addressInputSchema,
  addressSchema,
  type AddressInput,
  type SavedAddress,
} from "./schemas";

export type AddressResult<T> = { ok: true; data: T } | { ok: false; error: "invalid" | "generic" };

async function clearDefault(supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>) {
  // One default per person (a unique index), so the old one is cleared first.
  await supabase.from("addresses").update({ is_default: false }).eq("is_default", true);
}

/** Saves a new delivery address; by default it becomes the one used at checkout. */
export async function saveAddress(input: AddressInput): Promise<AddressResult<SavedAddress>> {
  const parsed = addressInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const supabase = await getSupabaseServerClient();
  const { makeDefault, ...fields } = parsed.data;
  if (makeDefault) await clearDefault(supabase);
  const { data, error } = await supabase
    .from("addresses")
    .insert({
      label: fields.label,
      line1: fields.line1,
      line2: fields.line2 || null,
      landmark: fields.landmark || null,
      lat: fields.lat ?? null,
      lng: fields.lng ?? null,
      is_default: makeDefault,
    })
    .select(ADDRESS_COLUMNS)
    .single();
  if (error) return { ok: false, error: "generic" };
  const saved = addressSchema.safeParse(data);
  if (!saved.success) return { ok: false, error: "generic" };
  refresh();
  return { ok: true, data: saved.data };
}

export async function setDefaultAddress(id: string): Promise<AddressResult<null>> {
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) return { ok: false, error: "invalid" };
  const supabase = await getSupabaseServerClient();
  await clearDefault(supabase);
  const { error } = await supabase
    .from("addresses")
    .update({ is_default: true })
    .eq("id", parsedId.data);
  if (error) return { ok: false, error: "generic" };
  refresh();
  return { ok: true, data: null };
}

export async function deleteAddress(id: string): Promise<AddressResult<null>> {
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) return { ok: false, error: "invalid" };
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("addresses").delete().eq("id", parsedId.data);
  if (error) return { ok: false, error: "generic" };
  refresh();
  return { ok: true, data: null };
}
