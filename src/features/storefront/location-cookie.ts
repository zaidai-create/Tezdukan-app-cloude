/** The shopper's delivery point, shared by the phone (which sets it) and the server (which reads it). */
export const LOCATION_COOKIE = "td_loc";
export const LOCATION_LABEL_COOKIE = "td_loc_label";

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
