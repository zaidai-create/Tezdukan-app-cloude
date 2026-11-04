"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Input } from "@/components/ui/input";
import { PriceField, rupeesText } from "@/features/shop-products/components/fields";
import { haptic } from "@/lib/haptics";
import { parseRupees } from "@/lib/money";
import { saveStorefront } from "../actions";
import { etaOptions, radiusOptions, type ShopStorefront } from "../schemas";

/** Rupees from a price field: empty is 0, anything unreadable is null. */
const rupees = (text: string) => (text.trim() === "" ? 0 : parseRupees(text));

/** Delivery time, fee, minimum order, free-delivery offer and a short line about the dukan. */
export function StorefrontForm({ store }: { store: ShopStorefront }) {
  const t = useTranslations("onlineDukan");
  const [pending, startTransition] = useTransition();
  const [eta, setEta] = useState(String(store.eta_minutes));
  const [fee, setFee] = useState(rupeesText(store.delivery_fee_paisa));
  const [minOrder, setMinOrder] = useState(rupeesText(store.min_order_paisa));
  const [freeAbove, setFreeAbove] = useState(rupeesText(store.free_delivery_above_paisa));
  const [tagline, setTagline] = useState(store.tagline ?? "");
  const [radius, setRadius] = useState(String(Math.min(store.delivery_radius_m, 5000)));
  const radii = [...new Set([...radiusOptions, Math.min(store.delivery_radius_m, 5000)])]
    .sort((a, b) => a - b)
    .map(String);
  const options = [...new Set([...etaOptions, store.eta_minutes])]
    .sort((a, b) => a - b)
    .map(String);

  const values = { fee: rupees(fee), minOrder: rupees(minOrder), freeAbove: rupees(freeAbove) };
  const invalid = Object.values(values).some((value) => value === null);

  const save = () =>
    startTransition(async () => {
      if (invalid) {
        toast.error(t("errors.invalid"));
        return;
      }
      const result = await saveStorefront(store.is_live, {
        eta_minutes: Number(eta),
        delivery_fee_paisa: values.fee ?? 0,
        min_order_paisa: values.minOrder ?? 0,
        free_delivery_above_paisa: values.freeAbove ?? 0,
        tagline,
        delivery_radius_m: Number(radius),
      });
      if (!result.ok) {
        haptic("warning");
        toast.error(t(`errors.${result.error}`));
        return;
      }
      haptic("success");
      toast.success(t("saved"));
    });

  return (
    <section className="flex flex-col gap-5 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
      <h2 className="font-heading text-lg font-bold text-ink">{t("termsTitle")}</h2>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-ink">{t("eta")}</p>
        <ChoiceChips
          options={options}
          value={eta}
          onChange={setEta}
          label={t("eta")}
          render={(value) => t("etaOption", { minutes: Number(value) })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-ink">{t("radius")}</p>
        <ChoiceChips
          options={radii}
          value={radius}
          onChange={setRadius}
          label={t("radius")}
          render={(value) => t("radiusOption", { km: Number(value) / 1000 })}
        />
        <p className="text-sm text-muted">{t("radiusHint")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">{t("fee")}</span>
          <PriceField
            value={fee}
            onChange={setFee}
            label={t("fee")}
            invalid={values.fee === null}
          />
          <span className="text-sm text-muted">{t("feeHint")}</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">{t("minOrder")}</span>
          <PriceField
            value={minOrder}
            onChange={setMinOrder}
            label={t("minOrder")}
            invalid={values.minOrder === null}
          />
          <span className="text-sm text-muted">{t("minOrderHint")}</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">{t("freeAbove")}</span>
          <PriceField
            value={freeAbove}
            onChange={setFreeAbove}
            label={t("freeAbove")}
            invalid={values.freeAbove === null}
          />
          <span className="text-sm text-muted">{t("freeAboveHint")}</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">{t("tagline")}</span>
          <Input
            value={tagline}
            maxLength={120}
            dir="auto"
            placeholder={t("taglinePlaceholder")}
            onChange={(event) => setTagline(event.target.value)}
          />
        </label>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={pending || !store.can_edit}
        className="sheen flex min-h-12 items-center justify-center gap-2 rounded-md bg-action px-4 font-semibold text-on-action shadow-glow inset-shadow-edge transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? (
          <Loader2 aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />
        ) : null}
        {t("save")}
      </button>
    </section>
  );
}
