"use client";

import { cn } from "cn";
import { ChevronDown, MapPin, Search, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { AddressLabelIcon } from "@/features/addresses/components/address-list";
import { addressText, labelKey, type SavedAddress } from "@/features/addresses/schemas";
import { Link, usePathname } from "@/i18n/navigation";
import type { DeliveryZone } from "../schemas";
import { LocationSheet } from "./location-picker";

/**
 * Where the order will go, always in the top bar of the shopping app: "Home" and the address
 * under it, with the fastest dukan's delivery time. Tap to pick another address or area.
 */
export function DeliverToButton({
  addresses,
  zones,
  selectedId,
  locationLabel,
  etaMinutes,
  className,
}: {
  addresses: SavedAddress[];
  zones: DeliveryZone[];
  /** The saved address orders go to; null while browsing by GPS or by area. */
  selectedId: string | null;
  /** The area or place being browsed when it is not a saved address. */
  locationLabel: string | null;
  etaMinutes: number | null;
  className?: string;
}) {
  const t = useTranslations("storefront");
  const [open, setOpen] = useState(false);
  const selected = addresses.find((address) => address.id === selectedId) ?? null;
  const place = selected ? addressText(selected) : locationLabel;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex min-h-12 min-w-0 items-center gap-2.5 rounded-md px-1 text-start active:bg-subtle",
          className,
        )}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
          {selected ? (
            <AddressLabelIcon label={selected.label} className="size-5" />
          ) : (
            <MapPin aria-hidden className="size-5" strokeWidth={1.75} />
          )}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1 font-heading text-base leading-tight font-bold text-ink">
            <span className="truncate">
              {selected
                ? t("header.deliverTo", { place: t(`cart.labels.${labelKey(selected.label)}`) })
                : place
                  ? t("header.deliverTo", { place })
                  : t("header.setLocation")}
            </span>
            <ChevronDown aria-hidden className="size-4 shrink-0 text-muted" />
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
            {etaMinutes ? (
              <span className="num flex shrink-0 items-center gap-0.5 font-bold text-primary-strong">
                <Zap aria-hidden className="size-3.5 fill-awning text-awning-ink" />
                {t("etaShort", { minutes: etaMinutes })}
              </span>
            ) : null}
            <span className="truncate" dir="auto">
              {selected ? place : place ? t("header.browsing") : t("addAddressHint")}
            </span>
          </span>
        </span>
      </button>
      <LocationSheet
        addresses={addresses}
        zones={zones}
        selectedId={selectedId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

const HINT_MS = 2600;

/**
 * The search field under the top bar on shopping screens. It is a link: the search screen has
 * the real field, with recent searches and results as you type. The hint cycles through things
 * people buy, so the field itself suggests what to look for.
 */
export function StorefrontSearchRow() {
  const t = useTranslations("storefront");
  const pathname = usePathname();
  const hints = [t("search.hint1"), t("search.hint2"), t("search.hint3"), t("search.hint4")];
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % 4), HINT_MS);
    return () => clearInterval(timer);
  }, []);

  // Browsing screens only: the cart, orders and account have no use for it.
  const browsing = pathname === "/" || pathname === "/categories" || pathname.startsWith("/shops");
  if (!browsing) return null;
  return (
    // Stays under the status bar while the shelf scrolls; 3.75rem tall, which the category
    // tabs count on to sit right below it.
    <div className="sticky top-[env(safe-area-inset-top)] z-30 bg-canvas/95 py-1.5 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4">
        <Link
          href="/search"
          className="flex h-12 items-center gap-3 rounded-full border border-border bg-surface ps-4 pe-4 text-base text-muted shadow-card"
        >
          <Search aria-hidden className="size-5 shrink-0 text-primary" strokeWidth={1.75} />
          <span className="sr-only">{t("searchLabel")}</span>
          <span aria-hidden className="truncate">
            {t("search.prompt")}{" "}
            <span
              key={index}
              className="font-semibold text-ink motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1"
            >
              {hints[index]}
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}
