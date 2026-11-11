"use client";

import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { haptic } from "@/lib/haptics";
import { deliveryPointCookies, type DeliveryPoint } from "./location-cookie";

/** Writes the delivery point where the server can read it (cookies). */
export function rememberDeliveryPoint(point: DeliveryPoint) {
  for (const cookie of deliveryPointCookies(point)) document.cookie = cookie;
}

/** Sets the delivery point and reloads what the screen shows for it. */
export function useDeliveryPoint() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const set = (point: DeliveryPoint) => {
    rememberDeliveryPoint(point);
    haptic("success");
    startTransition(() => router.refresh());
  };
  return { set, pending };
}
