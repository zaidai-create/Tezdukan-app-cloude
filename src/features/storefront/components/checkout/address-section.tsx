"use client";

import { ChevronDown, MapPin, Plus, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { AddressChoices, AddressLabelIcon } from "@/features/addresses/components/address-list";
import { addressText, labelKey, type SavedAddress } from "@/features/addresses/schemas";
import { Link } from "@/i18n/navigation";
import type { DeliveryZone } from "../../schemas";
import { LocationSheet } from "../location-picker";

/**
 * Where the order goes. An order always goes to a saved address with a map pin, so the dukan
 * and the rider can find it: this shows the chosen one, or asks for one before ordering.
 */
export function AddressSection({
  addresses,
  zones,
  selected,
}: {
  addresses: SavedAddress[];
  zones: DeliveryZone[];
  selected: SavedAddress | null;
}) {
  const t = useTranslations("storefront.cart");
  const [open, setOpen] = useState(false);

  if (!selected) {
    return (
      <section
        id="cart-address"
        tabIndex={-1}
        className="flex flex-col gap-3 rounded-lg border border-awning/50 bg-surface p-4 shadow-card outline-none"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-awning-soft text-awning-ink">
            <MapPin aria-hidden className="size-5" strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="font-heading text-lg font-bold text-ink">{t("addressMissingTitle")}</h2>
            <p className="text-sm text-muted">{t("addressMissingHint")}</p>
          </div>
        </div>
        {addresses.length > 0 ? (
          <AddressChoices addresses={addresses} selectedId={null} next="/cart" />
        ) : (
          <Link href="/addresses/new?next=%2Fcart" className={buttonVariants({ size: "lg" })}>
            <Plus aria-hidden />
            {t("addAddress")}
          </Link>
        )}
      </section>
    );
  }

  return (
    <>
      <section className="flex items-center gap-3 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
          <AddressLabelIcon label={selected.label} className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">{t("addressTitle")}</p>
          <p className="font-semibold text-ink">{t(`labels.${labelKey(selected.label)}`)}</p>
          <p className="line-clamp-2 text-sm text-ink" dir="auto">
            {addressText(selected)}
          </p>
        </div>
        <Button variant="soft" size="sm" onClick={() => setOpen(true)}>
          {t("change")}
        </Button>
      </section>
      <LocationSheet
        addresses={addresses}
        zones={zones}
        selectedId={selected.id}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

/**
 * The "Deliver to" pill: where dukans are shown for, in one line. Tap to choose a saved
 * address, the phone's location or an area.
 */
export function DeliveryPill({
  addresses,
  zones,
  selectedId,
  locationLabel,
  etaMinutes,
}: {
  addresses: SavedAddress[];
  zones: DeliveryZone[];
  /** The saved address orders go to; null while browsing by GPS or by area. */
  selectedId: string | null;
  locationLabel: string | null;
  etaMinutes: number | null;
}) {
  const t = useTranslations("storefront.cart");
  const tHome = useTranslations("storefront");
  const [open, setOpen] = useState(false);
  const selected = addresses.find((address) => address.id === selectedId) ?? null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-surface p-3 text-start shadow-card transition-transform duration-150 ease-out active:scale-[0.99]"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
          {selected ? (
            <AddressLabelIcon label={selected.label} className="size-5" />
          ) : (
            <MapPin aria-hidden className="size-5" strokeWidth={1.75} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-sm font-bold text-ink">
            {selected ? t(`labels.${labelKey(selected.label)}`) : t("addressTitle")}
            <ChevronDown aria-hidden className="size-4 text-muted" />
          </span>
          <span className="block truncate text-sm text-muted" dir="auto">
            {selected ? addressText(selected) : (locationLabel ?? tHome("addAddressHint"))}
          </span>
        </span>
        {etaMinutes ? (
          <span className="num flex shrink-0 items-center gap-1 rounded-full bg-mint-soft px-3 py-1.5 text-sm font-bold text-primary-strong">
            <Zap aria-hidden className="size-4" />
            {tHome("etaShort", { minutes: etaMinutes })}
          </span>
        ) : null}
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
