"use client";

import { ExternalLink, Loader2, LocateFixed, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { GeolocationProblem, getPosition } from "@/lib/geolocation";
import { haptic } from "@/lib/haptics";
import { setShopLocation } from "../actions";
import type { ShopStorefront } from "../schemas";

/**
 * The dukan's pin. Customers see a dukan only when they are inside its delivery radius around
 * this point, so the dukandar sets it standing in the dukan, with the phone's GPS.
 */
export function DeliveryArea({ store }: { store: ShopStorefront }) {
  const t = useTranslations("onlineDukan.area");
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const hasPin = store.lat !== null && store.lng !== null;
  const km = store.delivery_radius_m / 1000;

  const pin = async () => {
    setLocating(true);
    try {
      const position = await getPosition();
      startTransition(async () => {
        const result = await setShopLocation(position.lat, position.lng);
        if (!result.ok) {
          haptic("warning");
          toast.error(result.error === "invalid_location" ? t("outside") : t("failed"));
          return;
        }
        haptic("success");
        toast.success(t("saved"));
      });
    } catch (error) {
      haptic("warning");
      toast.error(
        error instanceof GeolocationProblem && error.problem === "denied"
          ? t("denied")
          : t("failed"),
      );
    } finally {
      setLocating(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
          <MapPin aria-hidden className="size-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-bold text-ink">{t("title")}</h2>
          <p className="text-sm text-muted">
            {store.serves_all_city ? t("allCity") : hasPin ? t("radius", { km }) : t("noPin")}
          </p>
        </div>
      </div>
      {hasPin ? (
        <a
          href={`https://www.google.com/maps?q=${store.lat},${store.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-full bg-subtle px-4 text-sm font-semibold text-ink"
        >
          <ExternalLink aria-hidden className="size-4" strokeWidth={1.75} />
          {t("seeOnMap")}
        </a>
      ) : null}
      {store.can_edit ? (
        <button
          type="button"
          onClick={() => void pin()}
          disabled={locating || pending}
          className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary-soft px-4 font-semibold text-primary-strong disabled:opacity-60"
        >
          {locating || pending ? (
            <Loader2 aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />
          ) : (
            <LocateFixed aria-hidden className="size-5" strokeWidth={1.75} />
          )}
          {hasPin ? t("movePin") : t("setPin")}
        </button>
      ) : null}
      <p className="text-sm text-muted">{t("standInShop")}</p>
    </section>
  );
}
