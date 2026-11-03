"use client";

import { cn } from "cn";
import { Briefcase, Check, House, LocateFixed, MapPin, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { saveAddress } from "@/features/addresses/actions";
import {
  addressLabels,
  addressText,
  type AddressLabel,
  type SavedAddress,
} from "@/features/addresses/schemas";
import { haptic } from "@/lib/haptics";
import { useCustomerCart } from "../../cart-store";

const labelKey = (label: string): AddressLabel =>
  (addressLabels as readonly string[]).includes(label) ? (label as AddressLabel) : "Other";
function LabelIcon({ label, className }: { label: string; className?: string }) {
  const key = labelKey(label);
  if (key === "Work") return <Briefcase aria-hidden className={className} strokeWidth={1.75} />;
  if (key === "Other") return <MapPin aria-hidden className={className} strokeWidth={1.75} />;
  return <House aria-hidden className={className} strokeWidth={1.75} />;
}

/** Asks the phone for the current location (only when the person taps the button). */
function useLocate() {
  const t = useTranslations("storefront.cart");
  const setDelivery = useCustomerCart((state) => state.setDelivery);
  const [locating, setLocating] = useState(false);
  const locate = () => {
    if (!("geolocation" in navigator)) return toast.error(t("locationFailed"));
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        haptic("success");
        setDelivery({ coords: { lat: position.coords.latitude, lng: position.coords.longitude } });
        toast.success(t("locationAdded"));
      },
      () => {
        setLocating(false);
        toast.error(t("locationFailed"));
      },
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  };
  return { locate, locating };
}

/** House and street, area or landmark, Home/Work/Other, and an optional map location. */
function AddressFields({ idPrefix }: { idPrefix: string }) {
  const t = useTranslations("storefront.cart");
  const address = useCustomerCart((state) => state.address);
  const addressExtra = useCustomerCart((state) => state.addressExtra);
  const addressLabel = useCustomerCart((state) => state.addressLabel);
  const coords = useCustomerCart((state) => state.coords);
  const setDelivery = useCustomerCart((state) => state.setDelivery);
  const { locate, locating } = useLocate();
  return (
    <div className="flex flex-col gap-3">
      <ChoiceChips
        options={addressLabels}
        value={addressLabel}
        onChange={(label) => setDelivery({ addressLabel: label })}
        label={t("labelLabel")}
        render={(label) => t(`labels.${label}`)}
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-address`}>{t("address")}</Label>
        <Input
          id={`${idPrefix}-address`}
          value={address}
          onChange={(event) => setDelivery({ address: event.target.value.slice(0, 200) })}
          placeholder={t("addressPlaceholder")}
          autoComplete="street-address"
          maxLength={200}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-area`}>{t("areaLabel")}</Label>
        <Input
          id={`${idPrefix}-area`}
          value={addressExtra}
          onChange={(event) => setDelivery({ addressExtra: event.target.value.slice(0, 120) })}
          placeholder={t("areaPlaceholder")}
          maxLength={120}
        />
      </div>
      <Button
        type="button"
        variant={coords ? "soft" : "secondary"}
        loading={locating}
        onClick={locate}
        className="self-start"
      >
        {coords ? <Check aria-hidden /> : <LocateFixed aria-hidden />}
        {coords ? t("locationAdded") : t("useLocation")}
      </Button>
    </div>
  );
}

/**
 * Where the order goes. With saved addresses it shows the chosen one and a Change sheet;
 * without, the fields sit right here and the address is saved with the first order.
 */
export function AddressSection({ addresses }: { addresses: SavedAddress[] }) {
  const t = useTranslations("storefront.cart");
  const addressId = useCustomerCart((state) => state.addressId);
  const setDelivery = useCustomerCart((state) => state.setDelivery);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, startSaving] = useTransition();
  const selected = addresses.find((a) => a.id === addressId) ?? addresses[0] ?? null;

  if (!selected) {
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-ink">
          <MapPin aria-hidden className="size-5 text-primary" />
          {t("addressTitle")}
        </h2>
        <AddressFields idPrefix="cart" />
      </section>
    );
  }

  const saveNew = () =>
    startSaving(async () => {
      const state = useCustomerCart.getState();
      const result = await saveAddress({
        label: state.addressLabel,
        line1: state.address,
        line2: state.addressExtra || undefined,
        lat: state.coords?.lat,
        lng: state.coords?.lng,
        makeDefault: true,
      });
      if (!result.ok) {
        toast.error(t("addressNeeded"));
        return;
      }
      haptic("success");
      setDelivery({ addressId: result.data.id, address: "", addressExtra: "", coords: null });
      toast.success(t("addressSaved"));
      setAdding(false);
      setOpen(false);
    });

  return (
    <>
      <section className="flex items-center gap-3 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
          <LabelIcon label={selected.label} className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">{t("addressTitle")}</p>
          <p className="font-semibold text-ink">{t(`labels.${labelKey(selected.label)}`)}</p>
          <p className="line-clamp-2 text-sm text-ink">{addressText(selected)}</p>
        </div>
        <Button variant="soft" size="sm" onClick={() => setOpen(true)}>
          {t("change")}
        </Button>
      </section>

      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setAdding(false);
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{adding ? t("addNew") : t("savedTitle")}</SheetTitle>
          </SheetHeader>
          <SheetBody>
            {adding ? (
              <AddressFields idPrefix="sheet" />
            ) : (
              <ul className="flex flex-col gap-2" role="radiogroup" aria-label={t("savedTitle")}>
                {addresses.map((item) => {
                  const on = item.id === selected.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => {
                          haptic("tap");
                          setDelivery({ addressId: item.id });
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border p-3 text-start transition-colors",
                          on ? "border-primary bg-primary-soft" : "border-border/70 bg-surface",
                        )}
                      >
                        <LabelIcon
                          label={item.label}
                          className="size-5 shrink-0 text-primary-strong"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-ink">
                            {t(`labels.${labelKey(item.label)}`)}
                          </span>
                          <span className="block truncate text-sm text-muted">
                            {addressText(item)}
                          </span>
                        </span>
                        {on ? <Check aria-hidden className="size-5 text-primary-strong" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </SheetBody>
          <SheetFooter>
            {adding ? (
              <Button size="lg" block loading={saving} onClick={saveNew}>
                {t("saveAddress")}
              </Button>
            ) : (
              <Button variant="secondary" size="lg" block onClick={() => setAdding(true)}>
                <Plus aria-hidden />
                {t("addNew")}
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
