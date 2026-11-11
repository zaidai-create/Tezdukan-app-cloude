"use server";

import { refresh } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { deliveryZoneSchema, type DeliveryZone } from "@/features/storefront/schemas";
import { actionLocale } from "@/i18n/action-locale";
import {
  geocodingProvider,
  reverseGeocode,
  searchPlaces,
  type GeocodedPlace,
} from "@/lib/integrations/geocoding";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  ADDRESS_COLUMNS,
  addressInputSchema,
  addressSchema,
  metresBetween,
  pointSchema,
  type AddressError,
  type AddressInput,
  type SavedAddress,
} from "./schemas";

export type AddressResult<T> = { ok: true; data: T } | { ok: false; error: AddressError };

/**
 * Saves a new delivery address or changes a saved one. A new address becomes the default
 * (the database moves the default over and keeps a person to five addresses).
 */
export async function saveAddress(input: AddressInput): Promise<AddressResult<SavedAddress>> {
  const parsed = addressInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { id, ...fields } = parsed.data;
  const row = {
    label: fields.label,
    line1: fields.line1,
    line2: fields.line2 || null,
    landmark: fields.landmark || null,
    lat: fields.lat,
    lng: fields.lng,
  };
  const supabase = await getSupabaseServerClient();
  const query = id
    ? supabase.from("addresses").update(row).eq("id", id)
    : supabase.from("addresses").insert({ ...row, is_default: true });
  const { data, error } = await query.select(ADDRESS_COLUMNS).single();
  if (error) {
    return { ok: false, error: error.message === "too_many_addresses" ? "too_many" : "generic" };
  }
  const saved = addressSchema.safeParse(data);
  if (!saved.success) return { ok: false, error: "generic" };
  refresh();
  return { ok: true, data: saved.data };
}

export async function setDefaultAddress(id: string): Promise<AddressResult<null>> {
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) return { ok: false, error: "invalid" };
  const supabase = await getSupabaseServerClient();
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

// A pin further than this from every delivery area's centre is not "near" any of them.
const NEAR_AREA_M = 6000;

const zoneName = (zone: DeliveryZone, locale: string) =>
  (locale === "ur" || locale === "sd") && zone.name_ur ? zone.name_ur : zone.name;

export type PinDescription = {
  /** The street address at the pin; null when nothing could be read (the person types it). */
  line: string | null;
  /** The delivery area the pin is in or beside. */
  area: string | null;
  /** How many dukans taking orders deliver to the pin. */
  dukans: number;
  /** The geocoder is in Sandbox: the line comes from the nearest area, not from a street map. */
  sandbox: boolean;
};

/**
 * What the address screen shows as the pin moves: the address there, and how many dukans
 * deliver to it, so nobody saves an address and only then learns nothing reaches it.
 */
export async function describePin(point: {
  lat: number;
  lng: number;
}): Promise<{ ok: true; data: PinDescription } | { ok: false }> {
  const parsed = pointSchema.safeParse(point);
  if (!parsed.success) return { ok: false };
  const supabase = await getSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return { ok: false };

  const locale = await actionLocale();
  const [t, street, zonesResult, dukansResult] = await Promise.all([
    getTranslations({ locale, namespace: "addresses" }),
    reverseGeocode(parsed.data.lat, parsed.data.lng, locale),
    supabase.rpc("delivery_zones"),
    supabase.rpc("nearby_dukans", { p_lat: parsed.data.lat, p_lng: parsed.data.lng, p_limit: 50 }),
  ]);

  const zones = z.array(deliveryZoneSchema).safeParse(zonesResult.data);
  const nearest = (zones.success ? zones.data : [])
    .map((zone) => ({ zone, metres: metresBetween(parsed.data, zone) }))
    .filter((entry) => entry.metres <= NEAR_AREA_M)
    .sort((a, b) => a.metres - b.metres)[0];
  const area = nearest ? zoneName(nearest.zone, locale) : null;
  const dukans = z.array(z.object({ is_live: z.boolean() })).safeParse(dukansResult.data);

  return {
    ok: true,
    data: {
      line: street ?? (area ? t("nearArea", { area }) : null),
      area,
      dukans: dukans.success ? dukans.data.filter((dukan) => dukan.is_live).length : 0,
      sandbox: geocodingProvider() === "sandbox",
    },
  };
}

/** Places matching what was typed: the city's delivery areas first, then the street map. */
export async function findPlaces(
  query: string,
): Promise<{ ok: true; data: GeocodedPlace[] } | { ok: false }> {
  const text = z.string().trim().min(2).max(80).safeParse(query);
  if (!text.success) return { ok: false };
  const supabase = await getSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return { ok: false };

  const locale = await actionLocale();
  const [zonesResult, places] = await Promise.all([
    supabase.rpc("delivery_zones"),
    searchPlaces(text.data, locale),
  ]);
  const zones = z.array(deliveryZoneSchema).safeParse(zonesResult.data);
  const wanted = text.data.toLowerCase();
  const areas = (zones.success ? zones.data : [])
    .filter(
      (zone) => zone.name.toLowerCase().includes(wanted) || (zone.name_ur ?? "").includes(wanted),
    )
    .map((zone) => ({ label: zoneName(zone, locale), lat: zone.lat, lng: zone.lng }));
  // The same place from both sources shows once.
  const seen = new Set<string>();
  const merged = [...areas, ...places].filter((place) => {
    const key = place.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { ok: true, data: merged.slice(0, 6) };
}
