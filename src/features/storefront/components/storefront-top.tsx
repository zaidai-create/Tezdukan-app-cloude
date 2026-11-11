import { MunshiButton } from "@/components/munshi/munshi-button";
import { UserMenu } from "@/components/layout/user-menu";
import { getMyAddresses } from "@/features/addresses/data";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { scopeOf } from "@/features/notifications/schemas";
import type { ShellSession } from "@/lib/auth/session-types";
import { getDeliveryZones, getNearbyShops } from "../data";
import { getCustomerLocation } from "../location";
import { DeliveryPointSync } from "./delivery-point-sync";
import { DeliverToButton, StorefrontSearchRow } from "./storefront-header";

/**
 * The top of the shopping app. First where the order goes and how fast (it scrolls away with
 * the page), then the search field, which stays put. The strip above them keeps the phone's
 * status bar area covered once the first row has scrolled off.
 */
export async function StorefrontTop({ session }: { session: ShellSession }) {
  const [addresses, zones, location, shops] = await Promise.all([
    getMyAddresses(),
    getDeliveryZones(),
    getCustomerLocation(),
    getNearbyShops(),
  ]);
  const etas = shops
    .filter((shop) => shop.is_live && shop.eta_minutes)
    .map((shop) => shop.eta_minutes ?? 0);
  return (
    <>
      <div aria-hidden className="sticky top-0 z-40 h-[env(safe-area-inset-top)] bg-canvas" />
      <header className="bg-canvas">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-1.5 px-4">
          <DeliverToButton
            addresses={addresses}
            zones={zones}
            selectedId={location?.addressId ?? null}
            locationLabel={location?.label ?? null}
            etaMinutes={etas.length > 0 ? Math.min(...etas) : null}
            className="flex-1"
          />
          <MunshiButton />
          <NotificationBell scope={scopeOf(session)} />
          <UserMenu session={session} />
        </div>
      </header>
      <StorefrontSearchRow />
      {location ? (
        <DeliveryPointSync
          lat={location.lat}
          lng={location.lng}
          label={location.label ?? ""}
          addressId={location.addressId}
        />
      ) : null}
    </>
  );
}
