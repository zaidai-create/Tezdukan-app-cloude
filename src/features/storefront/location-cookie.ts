/**
 * The shopper's delivery point, shared by the phone (which sets it) and the server (which
 * reads it). When the point is a saved address its id is kept too, so checkout knows which
 * address the order goes to.
 */
export const LOCATION_COOKIE = "td_loc";
export const LOCATION_LABEL_COOKIE = "td_loc_label";
export const ADDRESS_COOKIE = "td_addr";

/** "25.3960,68.3578" to a point, only when it is roughly in Pakistan. */
export function parseLocation(raw: string | undefined): { lat: number; lng: number } | null {
  if (!raw) return null;
  const [latText, lngText] = decodeURIComponent(raw).split(",");
  const lat = Number(latText);
  const lng = Number(lngText);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < 23 || lat > 37.5 || lng < 60 || lng > 78) return null;
  return { lat, lng };
}

export function formatLocation(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

export type DeliveryPoint = {
  lat: number;
  lng: number;
  /** Shown beside "Deliver to": the address line, the area's name or "Current location". */
  label: string;
  /** The saved address this point belongs to, when it is one. */
  addressId?: string | null;
};

const YEAR = 60 * 60 * 24 * 365;

/** The cookie strings for a delivery point (the address cookie is cleared when there is none). */
export function deliveryPointCookies(point: DeliveryPoint): string[] {
  const tail = `; path=/; max-age=${YEAR}; samesite=lax`;
  return [
    `${LOCATION_COOKIE}=${encodeURIComponent(formatLocation(point.lat, point.lng))}${tail}`,
    `${LOCATION_LABEL_COOKIE}=${encodeURIComponent(point.label.slice(0, 80))}${tail}`,
    point.addressId
      ? `${ADDRESS_COOKIE}=${point.addressId}${tail}`
      : `${ADDRESS_COOKIE}=; path=/; max-age=0; samesite=lax`,
  ];
}
