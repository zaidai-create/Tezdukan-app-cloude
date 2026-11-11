import { z } from "zod";

export const addressSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  line1: z.string(),
  line2: z.string().nullable(),
  landmark: z.string().nullable(),
  lat: z.coerce.number().nullable(),
  lng: z.coerce.number().nullable(),
  is_default: z.boolean(),
});
export type SavedAddress = z.infer<typeof addressSchema>;

export const ADDRESS_COLUMNS = "id, label, line1, line2, landmark, lat, lng, is_default";

export const addressLabels = ["Home", "Work", "Other"] as const;
export type AddressLabel = (typeof addressLabels)[number];

/** A person keeps a handful of addresses (home, work, a relative's); the database enforces it. */
export const MAX_ADDRESSES = 5;

// TezDukan delivers in Pakistan only; a pin elsewhere is a slip of the finger.
const latitude = z.number().min(23).max(37.5);
const longitude = z.number().min(60).max(78);

export const addressInputSchema = z.object({
  /** Set when changing a saved address. */
  id: z.uuid().optional(),
  label: z.enum(addressLabels),
  /** The street address, as read from the map and corrected by the person. */
  line1: z.string().trim().min(5).max(200),
  /** House, flat or floor. */
  line2: z.string().trim().max(80).optional(),
  landmark: z.string().trim().max(120).optional(),
  lat: latitude,
  lng: longitude,
});
export type AddressInput = z.input<typeof addressInputSchema>;

export const pointSchema = z.object({ lat: latitude, lng: longitude });

export const addressErrors = ["invalid", "too_many", "generic"] as const;
export type AddressError = (typeof addressErrors)[number];

/** One line for the order, the dukan and the rider: house or flat first, then the street. */
export function addressText(address: Pick<SavedAddress, "line1" | "line2" | "landmark">): string {
  return [address.line2, address.line1, address.landmark]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

/** The saved address as a known label, for its icon and its translated name. */
export const labelKey = (label: string): AddressLabel =>
  (addressLabels as readonly string[]).includes(label) ? (label as AddressLabel) : "Other";

/** Metres between two pins (haversine), for "has the pin really moved?". */
export function metresBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}
