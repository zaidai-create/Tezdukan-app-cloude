"use client";

import { ArrowLeft, Check, LocateFixed, MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { Link, useRouter } from "@/i18n/navigation";
import { haptic } from "@/lib/haptics";
import { formatPkMobile } from "@/lib/phone";
import { registerDistributor, registerDukan } from "../actions";
import type { Area } from "../schemas";

type Kind = "dukan" | "distributor";

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

/** Registers a dukan or a distributor business; approved ones land on their new home. */
export function RegisterForm({
  kind,
  areas,
  phone,
}: {
  kind: Kind;
  areas: Area[];
  phone: string | null;
}) {
  const t = useTranslations("onboarding.form");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [phoneValue, setPhoneValue] = useState(phone ? formatPkMobile(phone) : "");
  const [areaId, setAreaId] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [served, setServed] = useState<string[]>([]);
  const [waiting, setWaiting] = useState(false);

  const areaName = (area: Area) => (locale === "ur" && area.name_ur ? area.name_ur : area.name);

  const locate = () => {
    if (!("geolocation" in navigator)) return toast(t("locationFailed"));
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
        haptic("success");
      },
      () => {
        setLocating(false);
        toast(t("locationFailed"));
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const submit = () => {
    if (!areaId) return toast.error(t("errors.invalid_area"));
    const base = {
      name: name.trim(),
      phone: phoneValue,
      areaId,
      address: address.trim(),
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
    };
    startTransition(async () => {
      const result =
        kind === "dukan"
          ? await registerDukan(base)
          : await registerDistributor({ ...base, servedAreaIds: served });
      if (!result.ok) {
        haptic("warning");
        toast.error(t(`errors.${result.error}`));
        return;
      }
      haptic("success");
      if (!result.data.approved) return setWaiting(true);
      toast.success(t("successApproved", { name: base.name }));
      router.replace(result.data.home);
      router.refresh();
    });
  };

  if (waiting) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-awning-soft text-awning-ink">
          <Check aria-hidden className="size-8" />
        </span>
        <h1 className="font-heading text-2xl font-bold text-ink">{t("pendingTitle")}</h1>
        <p className="text-base text-muted">{t("pendingHint")}</p>
        <Button asChild size="lg">
          <Link href="/account">{t("pendingAction")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-5 pb-8">
      <header className="flex items-start gap-3">
        <Link
          href="/account"
          aria-label={t("back")}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-card"
        >
          <ArrowLeft aria-hidden className="size-5 rtl:-scale-x-100" />
        </Link>
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold text-ink">
            {kind === "dukan" ? t("dukanTitle") : t("distributorTitle")}
          </h1>
          <p className="text-sm text-muted">
            {kind === "dukan" ? t("dukanHint") : t("distributorHint")}
          </p>
        </div>
      </header>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-card">
        <Field id="r-name" label={kind === "dukan" ? t("dukanName") : t("businessName")}>
          <Input
            id="r-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={
              kind === "dukan" ? t("dukanNamePlaceholder") : t("businessNamePlaceholder")
            }
            maxLength={120}
            autoComplete="organization"
          />
        </Field>
        <Field id="r-phone" label={t("phone")}>
          <Input
            id="r-phone"
            dir="ltr"
            type="tel"
            inputMode="tel"
            value={phoneValue}
            onChange={(event) => setPhoneValue(event.target.value)}
            placeholder="0300 1234567"
            className="num text-start"
            autoComplete="tel"
          />
        </Field>
        <Field id="r-area" label={t("area")}>
          <Select value={areaId ?? ""} onValueChange={setAreaId}>
            <SelectTrigger id="r-area">
              <SelectValue placeholder={t("areaPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {areas.map((area) => (
                <SelectItem key={area.id} value={area.id}>
                  {areaName(area)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="r-address" label={t("address")}>
          <Input
            id="r-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder={t("addressPlaceholder")}
            maxLength={300}
            autoComplete="street-address"
          />
        </Field>
        <Button variant="secondary" loading={locating} onClick={locate}>
          {location ? <MapPin aria-hidden /> : <LocateFixed aria-hidden />}
          {location ? t("locationAdded") : t("location")}
        </Button>
      </section>

      {kind === "distributor" ? (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-card">
          <div>
            <h2 className="font-heading text-lg font-semibold text-ink">{t("servedAreas")}</h2>
            <p className="text-sm text-muted">{t("servedAreasHint")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {areas.map((area) => (
              <FilterChip
                key={area.id}
                selected={served.includes(area.id) || area.id === areaId}
                onSelectedChange={(on) =>
                  setServed((current) =>
                    on ? [...current, area.id] : current.filter((id) => id !== area.id),
                  )
                }
              >
                {areaName(area)}
              </FilterChip>
            ))}
          </div>
        </section>
      ) : null}

      <StickyActionBar>
        <Button
          size="lg"
          block
          loading={pending}
          disabled={name.trim().length < 2 || !areaId || address.trim().length < 3}
          onClick={submit}
        >
          <Check aria-hidden />
          {kind === "dukan" ? t("submitDukan") : t("submitDistributor")}
        </Button>
      </StickyActionBar>
    </div>
  );
}
