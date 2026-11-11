"use client";

import { cn } from "cn";
import { Loader2, LocateFixed, MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { describePin } from "@/features/addresses/actions";
import { AddressChoices } from "@/features/addresses/components/address-list";
import type { SavedAddress } from "@/features/addresses/schemas";
import { usePathname } from "@/i18n/navigation";
import { GeolocationProblem, getPosition } from "@/lib/geolocation";
import { haptic } from "@/lib/haptics";
import type { DeliveryZone } from "../schemas";
import { useDeliveryPoint } from "../use-delivery-point";

/**
 * The ways to say where delivery should go: a saved address (the usual choice), the phone's
 * location for a quick look around, or one of the city's areas when GPS is off or refused.
 */
export function LocationOptions({
  addresses,
  zones,
  selectedId,
  onDone,
}: {
  addresses: SavedAddress[];
  zones: DeliveryZone[];
  /** The saved address orders go to now, if any. */
  selectedId: string | null;
  onDone?: () => void;
}) {
  const t = useTranslations("storefront.location");
  const locale = useLocale();
  const pathname = usePathname();
  const { set, pending } = useDeliveryPoint();
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState<"denied" | "failed" | null>(null);

  const locate = async () => {
    setLocating(true);
    setProblem(null);
    try {
      const position = await getPosition();
      // "Near Latifabad" says more than "Current location"; it is worth a short wait.
      const described = await describePin(position).catch(() => null);
      const label = described?.ok
        ? (described.data.area ?? described.data.line ?? t("current"))
        : t("current");
      set({ lat: position.lat, lng: position.lng, label });
      toast.success(t("found"));
      onDone?.();
    } catch (error) {
      haptic("warning");
      setProblem(error instanceof GeolocationProblem ? error.problem : "failed");
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
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
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-muted">{t("saved")}</h3>
        <AddressChoices
          addresses={addresses}
          selectedId={selectedId}
          next={pathname}
          onChosen={onDone}
        />
      </section>

      {zones.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-muted">{t("areas")}</h3>
          <div className="flex flex-wrap gap-2">
            {zones.map((zone) => {
              const name =
                (locale === "ur" || locale === "sd") && zone.name_ur ? zone.name_ur : zone.name;
              return (
                <button
                  key={zone.id}
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    set({ lat: zone.lat, lng: zone.lng, label: name });
                    onDone?.();
                  }}
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
      <LocationOptions addresses={addresses} zones={zones} selectedId={null} />
    </section>
  );
}

/** The same choices in a sheet, from the "Deliver to" pill and from checkout. */
export function LocationSheet({
  addresses,
  zones,
  selectedId,
  open,
  onOpenChange,
}: {
  addresses: SavedAddress[];
  zones: DeliveryZone[];
  selectedId: string | null;
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
          <LocationOptions
            addresses={addresses}
            zones={zones}
            selectedId={selectedId}
            onDone={() => onOpenChange(false)}
          />
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
