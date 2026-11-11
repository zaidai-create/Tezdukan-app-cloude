"use client";

import { useEffect } from "react";
import { readDeliveryPoint } from "../queries";
import { rememberDeliveryPoint } from "../use-delivery-point";

/**
 * The server may have settled on the shopper's default address without the phone ever
 * choosing one (a new phone, cleared cookies). The screens that ask the database directly
 * (search, the product page) read the delivery point from the cookie, so the server's choice
 * is written there once it is known.
 */
export function DeliveryPointSync({
  lat,
  lng,
  label,
  addressId,
}: {
  lat: number;
  lng: number;
  label: string;
  addressId: string | null;
}) {
  useEffect(() => {
    const known = readDeliveryPoint();
    const same =
      known !== null && Math.abs(known.lat - lat) < 0.00002 && Math.abs(known.lng - lng) < 0.00002;
    if (!same) rememberDeliveryPoint({ lat, lng, label, addressId });
  }, [lat, lng, label, addressId]);
  return null;
}
