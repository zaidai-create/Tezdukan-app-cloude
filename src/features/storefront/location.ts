import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { z } from "zod";
import { getMyAddresses } from "@/features/addresses/data";
import { LOCATION_COOKIE, LOCATION_LABEL_COOKIE, parseLocation } from "./location-cookie";

export type CustomerLocation = { lat: number; lng: number; label: string | null };

/**
 * Where the shopper wants delivery: the point they chose (GPS, an area or a saved address,
 * kept in a cookie so the server can filter dukans), else their default saved address with a
 * map point. Null until they choose, and the app then asks before showing any dukan.
 */
export const getCustomerLocation = cache(async (): Promise<CustomerLocation | null> => {
  const store = await cookies();
  const point = parseLocation(store.get(LOCATION_COOKIE)?.value);
  if (point) {
    const label = z.string().max(120).safeParse(store.get(LOCATION_LABEL_COOKIE)?.value);
    return { ...point, label: label.success ? decodeURIComponent(label.data) : null };
  }
  const addresses = await getMyAddresses().catch(() => []);
  const withPoint = addresses.find((address) => address.lat !== null && address.lng !== null);
  if (withPoint?.lat != null && withPoint.lng != null) {
    return { lat: withPoint.lat, lng: withPoint.lng, label: withPoint.line1 };
  }
  return null;
});
