"use client";

import { ArrowLeft, ArrowRight, Check, LocateFixed, LockKeyhole, MapPin } from "lucide-react";
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
import { cn } from "cn";
import { registerDistributor, registerDukan } from "../actions";
import { type Area, formatCnic } from "../schemas";
import { CnicBackArt, CnicFrontArt, ShopFrontArt } from "./document-art";
import { DocumentPicker } from "./document-picker";

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

/** "Step 1 of 2" with a two-part bar, so the person knows how much is left. */
function Steps({ current, labels }: { current: 0 | 1; labels: [string, string] }) {
  const t = useTranslations("onboarding.form");
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-muted">
        {t("stepOf", { step: current + 1, total: 2 })} · {labels[current]}
      </p>
      <div className="grid grid-cols-2 gap-1.5" aria-hidden>
        {labels.map((label, index) => (
          <span
            key={label}
            className={cn(
              "h-1.5 rounded-full transition-colors duration-200",
              index <= current ? "bg-action" : "bg-border-strong/40",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Registers a dukan or a distributor business in two steps: the business, then the owner's
 * CNIC and a photo of the place. It waits for the TezDukan team; the status page says how it
 * goes. With auto-approval on (testing) it lands on the new home at once.
 */
export function RegisterForm({
  kind,
  areas,
  phone,
  userId,
}: {
  kind: Kind;
  areas: Area[];
  phone: string | null;
  userId: string;
}) {
  const t = useTranslations("onboarding.form");
  const td = useTranslations("onboarding.documents");
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
  const [step, setStep] = useState<0 | 1>(0);
  const [cnic, setCnic] = useState("");
  const [front, setFront] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [ntn, setNtn] = useState("");
  const [strn, setStrn] = useState("");
  const detailsReady = name.trim().length >= 2 && Boolean(areaId) && address.trim().length >= 3;
  const cnicDigits = cnic.replace(/\D/g, "");
  const documentsReady = cnicDigits.length === 13 && Boolean(front && back && place);
  // The drawing of the shop carries their own name on its board.
  const signboard = (name.trim() || td("signExample")).toUpperCase().slice(0, 20);

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
    if (!front || !back || !place) return toast.error(t("errors.documents_required"));
    const base = {
      name: name.trim(),
      phone: phoneValue,
      areaId,
      address: address.trim(),
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
      cnic: cnicDigits,
      cnicFrontPath: front,
      cnicBackPath: back,
      placePhotoPath: place,
      ntn: ntn.trim() || undefined,
      strn: strn.trim() || undefined,
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
      if (!result.data.approved) {
        router.replace("/register/status?sent=1");
        return;
      }
      toast.success(t("successApproved", { name: base.name }));
      router.replace(result.data.home);
      router.refresh();
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-5 pb-8">
      <header className="flex items-start gap-3">
        {step === 1 ? (
          <button
            type="button"
            onClick={() => setStep(0)}
            aria-label={t("back")}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-card"
          >
            <ArrowLeft aria-hidden className="size-5 rtl:-scale-x-100" />
          </button>
        ) : (
          <Link
            href="/account"
            aria-label={t("back")}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-card"
          >
            <ArrowLeft aria-hidden className="size-5 rtl:-scale-x-100" />
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold text-ink">
            {kind === "dukan" ? t("dukanTitle") : t("distributorTitle")}
          </h1>
          <p className="text-sm text-muted">
            {kind === "dukan" ? t("dukanHint") : t("distributorHint")}
          </p>
        </div>
      </header>

      <Steps current={step} labels={[t("stepDetails"), t("stepDocuments")]} />

      {step === 1 ? (
        <>
          <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-card">
            <div>
              <h2 className="font-heading text-lg font-semibold text-ink">{td("ownerTitle")}</h2>
              <p className="text-sm text-muted">{td("ownerHint")}</p>
            </div>
            <Field id="r-cnic" label={td("cnic")} hint={td("cnicHint")}>
              <Input
                id="r-cnic"
                dir="ltr"
                inputMode="numeric"
                value={cnic}
                onChange={(event) => setCnic(formatCnic(event.target.value))}
                placeholder="41303-1234567-1"
                maxLength={15}
                autoComplete="off"
                className="num text-start tracking-wide"
              />
            </Field>
          </section>

          <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-card">
            <div>
              <h2 className="font-heading text-lg font-semibold text-ink">{td("cnicPhotos")}</h2>
              <p className="text-sm text-muted">{td("cnicPhotosHint")}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DocumentPicker
                userId={userId}
                shape="card"
                name={td("front")}
                caption={td("frontShort")}
                art={<CnicFrontArt />}
                onUploaded={setFront}
              />
              <DocumentPicker
                userId={userId}
                shape="card"
                name={td("back")}
                caption={td("backShort")}
                art={<CnicBackArt />}
                onUploaded={setBack}
              />
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-card">
            <div>
              <h2 className="font-heading text-lg font-semibold text-ink">
                {kind === "dukan" ? td("shopPhoto") : td("placePhoto")}
              </h2>
              <p className="text-sm text-muted">
                {kind === "dukan" ? td("shopPhotoHint") : td("placePhotoHint")}
              </p>
            </div>
            <DocumentPicker
              userId={userId}
              shape="wide"
              name={kind === "dukan" ? td("shopPhoto") : td("placePhoto")}
              art={<ShopFrontArt sign={signboard} />}
              onUploaded={setPlace}
            />
          </section>

          <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-card">
            <div>
              <h2 className="font-heading text-lg font-semibold text-ink">{td("taxTitle")}</h2>
              <p className="text-sm text-muted">{td("taxHint")}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field id="r-ntn" label={td("ntn")}>
                <Input
                  id="r-ntn"
                  dir="ltr"
                  value={ntn}
                  onChange={(event) => setNtn(event.target.value)}
                  maxLength={20}
                  className="num text-start"
                />
              </Field>
              <Field id="r-strn" label={td("strn")}>
                <Input
                  id="r-strn"
                  dir="ltr"
                  value={strn}
                  onChange={(event) => setStrn(event.target.value)}
                  maxLength={20}
                  className="num text-start"
                />
              </Field>
            </div>
          </section>

          <p className="flex items-start gap-2 px-1 text-sm text-muted">
            <LockKeyhole aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            {td("privacy")}
          </p>
        </>
      ) : (
        <>
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
        </>
      )}

      <StickyActionBar>
        {step === 0 ? (
          <Button
            size="lg"
            block
            disabled={!detailsReady}
            onClick={() => {
              haptic("tap");
              setStep(1);
              window.scrollTo({ top: 0 });
            }}
          >
            {t("next")}
            <ArrowRight aria-hidden className="rtl:-scale-x-100" />
          </Button>
        ) : (
          <Button size="lg" block loading={pending} disabled={!documentsReady} onClick={submit}>
            <Check aria-hidden />
            {kind === "dukan" ? t("submitDukan") : t("submitDistributor")}
          </Button>
        )}
      </StickyActionBar>
    </div>
  );
}
