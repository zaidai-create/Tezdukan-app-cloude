"use client";

import { cn } from "cn";
import { Loader2, LocateFixed, MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { SavedAddress } from "@/features/addresses/schemas";
import { useRouter } from "@/i18n/navigation";
import { GeolocationProblem, getPosition } from "@/lib/geolocation";
import { haptic } from "@/lib/haptics";
import { useCustomerCart } from "../cart-store";
import { formatLocation, LOCATION_COOKIE, LOCATION_LABEL_COOKIE } from "../location-cookie";
import type { DeliveryZone } from "../schemas";

const YEAR = 60 * 60 * 24 * 365;

/** Saves the delivery point for the server (cookie) and reloads what the screen shows. */
function useSetLocation() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const set = (lat: number, lng: number, label: string) => {
    const value = encodeURIComponent(formatLocation(lat, lng));
    document.cookie = `${LOCATION_COOKIE}=${value}; path=/; max-age=${YEAR}; samesite=lax`;
    document.cookie = `${LOCATION_LABEL_COOKIE}=${encodeURIComponent(label.slice(0, 80))}; path=/; max-age=${YEAR}; samesite=lax`;
    haptic("success");
    startTransition(() => router.refresh());
  };
  return { set, pending };
}

/**
 * The ways to say where delivery should go: the phone's location (most accurate), a saved
 * address with a map point, or one of the city's areas when GPS is off or refused.
 */
export function LocationOptions({
  addresses,
  zones,
  onDone,
}: {
  addresses: SavedAddress[];
  zones: DeliveryZone[];
  onDone?: () => void;
}) {
  const t = useTranslations("storefront.location");
  const locale = useLocale();
  const setDelivery = useCustomerCart((state) => state.setDelivery);
  const { set, pending } = useSetLocation();
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState<"denied" | "failed" | null>(null);
  const withPoint = addresses.filter((address) => address.lat !== null && address.lng !== null);

  const choose = (lat: number, lng: number, label: string) => {
    set(lat, lng, label);
    onDone?.();
  };

  const locate = async () => {
    setLocating(true);
    setProblem(null);
    try {
      const position = await getPosition();
      choose(position.lat, position.lng, t("current"));
      toast.success(t("found"));
    } catch (error) {
      haptic("warning");
      setProblem(error instanceof GeolocationProblem ? error.problem : "failed");
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => void locate()}
        disabled={locating || pending}
        className="sheen flex min-h-14 items-center justify-center gap-2 rounded-md bg-action px-4 text-base font-semibold text-on-action shadow-glow inset-shadow-edge disabled:opacity-70"
      >
        {locating || pending ? (
          <Loader2 aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />
        ) : (
          <LocateFixed aria-hidden className="size-5" strokeWidth={1.75} />
        )}
        {locating ? t("locating") : t("useCurrent")}
      </button>
      {problem ? (
        <p role="alert" className="rounded-md bg-awning-soft px-3 py-2 text-sm text-awning-ink">
          {problem === "denied" ? t("denied") : t("failed")}
        </p>
      ) : null}

      {withPoint.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-muted">{t("saved")}</h3>
          <ul className="flex flex-col gap-2">
            {withPoint.map((address) => (
              <li key={address.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setDelivery({ addressId: address.id });
                    choose(address.lat ?? 0, address.lng ?? 0, address.line1);
                  }}
                  className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-border/70 bg-surface px-3 text-start"
                >
                  <MapPin aria-hidden className="size-5 shrink-0 text-primary" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                    {address.line1}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {zones.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-muted">{t("areas")}</h3>
          <div className="flex flex-wrap gap-2">
            {zones.map((zone) => {
              const name = locale === "ur" && zone.name_ur ? zone.name_ur : zone.name;
              return (
                <button
                  key={zone.id}
                  type="button"
                  disabled={pending}
                  onClick={() => choose(zone.lat, zone.lng, name)}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-semibold text-ink",
                    "transition-colors duration-150 ease-out active:bg-primary-soft",
                  )}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** Shown instead of dukans and products until the shopper says where to deliver. */
export function LocationPrompt({
  addresses,
  zones,
}: {
  addresses: SavedAddress[];
  zones: DeliveryZone[];
}) {
  const t = useTranslations("storefront.location");
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border/60 bg-surface p-5 shadow-raised">
      <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
        <MapPin aria-hidden className="size-7" strokeWidth={1.75} />
      </span>
      <div>
        <h2 className="font-heading text-xl font-bold text-ink">{t("title")}</h2>
        <p className="text-base text-muted">{t("hint")}</p>
      </div>
      <LocationOptions addresses={addresses} zones={zones} />
    </section>
  );
}

/** The same choices in a sheet, from Home's "Deliver to" pill. */
export function LocationSheet({
  addresses,
  zones,
  open,
  onOpenChange,
}: {
  addresses: SavedAddress[];
  zones: DeliveryZone[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("storefront.location");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t("sheetTitle")}</SheetTitle>
          <SheetDescription>{t("hint")}</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <LocationOptions addresses={addresses} zones={zones} onDone={() => onOpenChange(false)} />
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
