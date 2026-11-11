import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { z } from "zod";
import { getMyAddresses } from "@/features/addresses/data";
import {
  ADDRESS_COOKIE,
  LOCATION_COOKIE,
  LOCATION_LABEL_COOKIE,
  parseLocation,
} from "./location-cookie";

export type CustomerLocation = {
  lat: number;
  lng: number;
  label: string | null;
  /** The saved address chosen for delivery; null while browsing by GPS or by area. */
  addressId: string | null;
};

/**
 * Where the shopper wants delivery. A saved address they picked wins, and its own pin is
 * used (not the cookie's copy, which goes stale when the address is edited elsewhere). Next
 * comes the point they chose by GPS or by area. With neither, their default address. Null
 * until they choose, and the app then asks before showing any dukan.
 */
export const getCustomerLocation = cache(async (): Promise<CustomerLocation | null> => {
  const store = await cookies();
  const point = parseLocation(store.get(LOCATION_COOKIE)?.value);
  const picked = z.uuid().safeParse(store.get(ADDRESS_COOKIE)?.value);

  if (picked.success || !point) {
    const addresses = await getMyAddresses().catch(() => []);
    const address = picked.success
      ? addresses.find((candidate) => candidate.id === picked.data)
      : addresses[0];
    if (address && address.lat !== null && address.lng !== null) {
      return { lat: address.lat, lng: address.lng, label: address.line1, addressId: address.id };
    }
  }
  if (!point) return null;
  const label = z.string().max(120).safeParse(store.get(LOCATION_LABEL_COOKIE)?.value);
  return {
    ...point,
    label: label.success ? decodeURIComponent(label.data) : null,
    addressId: null,
  };
});
