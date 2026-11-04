"use client";

import { cn } from "cn";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { haptic } from "@/lib/haptics";
import { setShopDelivery } from "../actions";

const kmOptions = [1, 2, 3, 4, 5, 8, 10, 15] as const;

/** The admin's say over how far a dukan delivers: a radius, or the whole city. */
export function DeliveryControl({
  shopId,
  radiusM,
  allCity,
  hasPin,
  canEdit,
}: {
  shopId: string;
  radiusM: number;
  allCity: boolean;
  hasPin: boolean;
  canEdit: boolean;
}) {
  const t = useTranslations("admin.delivery");
  const tActions = useTranslations("admin.actions");
  const [km, setKm] = useState(Math.round(radiusM / 100) / 10);
  const [city, setCity] = useState(allCity);
  const [pending, startTransition] = useTransition();
  const changed = km * 1000 !== radiusM || city !== allCity;

  const save = () =>
    startTransition(async () => {
      const result = await setShopDelivery(shopId, Math.round(km * 1000), city);
      if (!result.ok) {
        haptic("warning");
        toast.error(tActions(`errors.${result.error}`));
        return;
      }
      haptic("success");
      toast.success(tActions("saved"));
    });

  return (
    <section className="flex flex-col gap-3 rounded-md bg-subtle p-3">
      <div>
        <h3 className="font-semibold text-ink">{t("title")}</h3>
        <p className="text-sm text-muted">
          {city ? t("allCity") : t("radius", { km })}
          {hasPin ? null : ` · ${t("noPin")}`}
        </p>
      </div>
      {canEdit ? (
        <>
          <div role="radiogroup" aria-label={t("title")} className="flex flex-wrap gap-1.5">
            {kmOptions.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={km === option}
                disabled={city}
                onClick={() => setKm(option)}
                className={cn(
                  "num inline-flex h-10 items-center rounded-full border px-3 text-sm font-semibold disabled:opacity-50",
                  km === option
                    ? "border-primary bg-primary-soft text-primary-strong"
                    : "border-border bg-surface text-ink",
                )}
              >
                {t("km", { km: option })}
              </button>
            ))}
          </div>
          <label className="flex items-center justify-between gap-3 text-sm font-semibold text-ink">
            {t("cityToggle")}
            <Switch checked={city} onCheckedChange={setCity} aria-label={t("cityToggle")} />
          </label>
          <button
            type="button"
            onClick={save}
            disabled={!changed || pending}
            className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-action px-4 text-sm font-semibold text-on-action disabled:opacity-50"
          >
            {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            {t("save")}
          </button>
        </>
      ) : null}
    </section>
  );
}
