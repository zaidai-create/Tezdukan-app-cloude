import "server-only";
import { cacheLife } from "next/cache";
import { z } from "zod";

/**
 * Turns a map pin into words ("Prince Ali Road, Heerabad") and a typed place into a pin.
 * `nominatim` is OpenStreetMap's free geocoder: no key, but at most one request a second for
 * the whole app and no search-as-you-type, so answers are cached and search runs on submit.
 * `sandbox` makes no network call: the caller falls back to the nearest delivery area.
 * Any other geocoder (Google, Mapbox) is one more branch here; nothing else changes.
 */
const geocodingEnvSchema = z.object({
  GEOCODING_PROVIDER: z.enum(["nominatim", "sandbox"]).default("nominatim"),
  GEOCODING_BASE_URL: z.url().default("https://nominatim.openstreetmap.org"),
  // Nominatim asks every app to say who it is.
  GEOCODING_USER_AGENT: z.string().min(3).default("TezDukan/1.0 (+https://tezdukan.vercel.app)"),
});

function geocodingEnv() {
  return geocodingEnvSchema.parse({
    GEOCODING_PROVIDER: process.env.GEOCODING_PROVIDER || undefined,
    GEOCODING_BASE_URL: process.env.GEOCODING_BASE_URL || undefined,
    GEOCODING_USER_AGENT: process.env.GEOCODING_USER_AGENT || undefined,
  });
}

export function geocodingProvider(): "nominatim" | "sandbox" {
  return geocodingEnv().GEOCODING_PROVIDER;
}

export type GeocodedPlace = { label: string; lat: number; lng: number };

// Hyderabad and its edges (Qasimabad, Latifabad, Kotri side): left, top, right, bottom.
const HYDERABAD_BOX = "68.20,25.55,68.55,25.25";
const TIMEOUT_MS = 5000;

const addressPartsSchema = z
  .object({
    house_number: z.string(),
    road: z.string(),
    pedestrian: z.string(),
    residential: z.string(),
    neighbourhood: z.string(),
    quarter: z.string(),
    suburb: z.string(),
    city_district: z.string(),
    village: z.string(),
    town: z.string(),
    city: z.string(),
    county: z.string(),
  })
  .partial();
type AddressParts = z.infer<typeof addressPartsSchema>;

const reverseSchema = z.object({
  name: z.string().nullish(),
  display_name: z.string().nullish(),
  address: addressPartsSchema.nullish(),
});

const searchSchema = z.array(
  z.object({
    lat: z.coerce.number(),
    lon: z.coerce.number(),
    name: z.string().nullish(),
    display_name: z.string(),
    address: addressPartsSchema.nullish(),
  }),
);

// The street map writes the city several ways ("Hyderabad City Taluka", "حیدرآباد" even when
// English was asked for). A rider needs one plain name, in the language of the rest.
const HYDERABAD = /hyderabad|حیدر\s?آباد|حيدر\s?آباد/i;
function cityName(raw: string | undefined, language: string): string | undefined {
  if (!raw) return undefined;
  if (HYDERABAD.test(raw)) return language.startsWith("ur") ? "حیدرآباد" : "Hyderabad";
  return raw.replace(/\s+(City\s+)?(Taluka|Tehsil|District)$/i, "");
}

const unique = (parts: (string | null | undefined)[]) =>
  parts
    .map((part) => part?.trim())
    .filter((part, index, all): part is string => Boolean(part) && all.indexOf(part) === index);

/**
 * One short line a rider can follow: the road (or the place's name), the mohalla, the city.
 * The country, province and postcode say nothing a Hyderabad rider needs.
 */
export function formatAddressLine(
  parts: AddressParts | null | undefined,
  name?: string | null,
  language = "en",
): string | null {
  if (!parts) return name?.trim() || null;
  const road = parts.road ?? parts.pedestrian ?? parts.residential;
  const street = road ? [parts.house_number, road].filter(Boolean).join(" ") : null;
  const mohalla = parts.neighbourhood ?? parts.quarter ?? parts.suburb ?? parts.city_district;
  const city = cityName(parts.city ?? parts.town ?? parts.village ?? parts.county, language);
  // A named place (a masjid, a market) helps more than a bare road.
  const named = name && name !== road ? name : null;
  const line = unique([named, street, mohalla, city]).join(", ");
  return line || null;
}

async function nominatim(path: string, params: Record<string, string>, language: string) {
  const env = geocodingEnv();
  const url = new URL(path, env.GEOCODING_BASE_URL);
  url.search = new URLSearchParams({ format: "jsonv2", addressdetails: "1", ...params }).toString();
  const response = await fetch(url, {
    headers: { "User-Agent": env.GEOCODING_USER_AGENT, "Accept-Language": language },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`geocoding ${response.status}`);
  return (await response.json()) as unknown;
}

// Cached by a pin rounded to about 11 m, so dragging the map back and forth costs nothing
// and the shared geocoder sees far fewer requests. A failure throws, so it is never cached.
async function cachedReverse(lat: string, lng: string, language: string) {
  "use cache";
  cacheLife("weeks");
  const parsed = reverseSchema.parse(
    await nominatim("/reverse", { lat, lon: lng, zoom: "18" }, language),
  );
  return formatAddressLine(parsed.address, parsed.name, language) ?? parsed.display_name ?? null;
}

async function cachedSearch(query: string, language: string) {
  "use cache";
  cacheLife("days");
  const parsed = searchSchema.parse(
    await nominatim(
      "/search",
      { q: query, countrycodes: "pk", viewbox: HYDERABAD_BOX, bounded: "1", limit: "6" },
      language,
    ),
  );
  return parsed.map((place) => ({
    label: formatAddressLine(place.address, place.name, language) ?? place.display_name,
    lat: place.lat,
    lng: place.lon,
  }));
}

const languageFor = (locale: string) => (locale === "ur" || locale === "sd" ? "ur,en" : "en");

/** The address at a pin, or null when the geocoder is off, slow or has nothing there. */
export async function reverseGeocode(
  lat: number,
  lng: number,
  locale: string,
): Promise<string | null> {
  if (geocodingProvider() === "sandbox") return null;
  try {
    return await cachedReverse(lat.toFixed(4), lng.toFixed(4), languageFor(locale));
  } catch {
    return null;
  }
}

/** Places in and around Hyderabad matching what the person typed (searched on submit). */
export async function searchPlaces(query: string, locale: string): Promise<GeocodedPlace[]> {
  const cleaned = query.trim().replace(/\s+/g, " ").toLowerCase().slice(0, 80);
  if (cleaned.length < 3 || geocodingProvider() === "sandbox") return [];
  try {
    return await cachedSearch(cleaned, languageFor(locale));
  } catch {
    return [];
  }
}
