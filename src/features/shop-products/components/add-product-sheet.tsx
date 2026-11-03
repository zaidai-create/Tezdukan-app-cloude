"use client";

import { cn } from "cn";
import { ChevronRight, Mic, PenLine, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ProductImage } from "@/components/commerce/product-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { storageUrl } from "@/features/ordering/images";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { speechLang, type Locale } from "@/i18n/locales";
import { haptic } from "@/lib/haptics";
import { formatRs, parseRupees } from "@/lib/money";
import { addProducts, searchCatalog } from "../actions";
import type { MasterMatch } from "../schemas";
import { PriceField, QtyField, rupeesText } from "./fields";

type Step = { kind: "search" } | { kind: "catalog"; product: MasterMatch } | { kind: "own" };

/**
 * Add one product: find it in the TezDukan catalogue (type or speak its name), then set the
 * price and how many are on the shelf. Anything not in the catalogue is added by name.
 */
export function AddProductSheet({
  onClose,
  listenOnOpen = false,
}: {
  onClose: () => void;
  listenOnOpen?: boolean;
}) {
  const t = useTranslations("shopProducts");
  const locale = useLocale() as Locale;
  const [step, setStep] = useState<Step>({ kind: "search" });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MasterMatch[]>([]);
  const [searching, startSearch] = useTransition();
  const [name, setName] = useState("");
  const [pack, setPack] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState(10);
  const [saving, startSave] = useTransition();
  const voice = useVoiceInput(speechLang[locale], { onEnd: (heard) => heard && setQuery(heard) });
  const { start: startVoice, cancel: cancelVoice } = voice;

  useEffect(() => {
    if (listenOnOpen) startVoice();
    return cancelVoice;
  }, [listenOnOpen, startVoice, cancelVoice]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = setTimeout(
      () => startSearch(async () => setResults(await searchCatalog(q))),
      250,
    );
    return () => clearTimeout(timer);
  }, [query]);

  const pick = (product: MasterMatch) => {
    haptic("tap");
    setPrice(rupeesText(product.mrp_paisa));
    setStep({ kind: "catalog", product });
  };

  const own = () => {
    setName(query.trim());
    setPrice("");
    setStep({ kind: "own" });
  };

  const pricePaisa = parseRupees(price);
  const canSave = pricePaisa !== null && (step.kind === "catalog" || name.trim().length >= 2);

  const save = () =>
    startSave(async () => {
      if (pricePaisa === null) return;
      const result = await addProducts([
        step.kind === "catalog"
          ? { master_product_id: step.product.id, selling_price_paisa: pricePaisa, qty }
          : {
              name: name.trim(),
              pack_size_label: pack.trim() || undefined,
              selling_price_paisa: pricePaisa,
              qty,
            },
      ]);
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      haptic("success");
      toast.success(
        t("addedOne", { name: step.kind === "catalog" ? step.product.name : name.trim() }),
      );
      onClose();
    });

  const listening = voice.status === "listening";

  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{step.kind === "own" ? t("ownTitle") : t("addTitle")}</SheetTitle>
          <SheetDescription>
            {step.kind === "search" ? t("addHint") : t("detailsHint")}
          </SheetDescription>
        </SheetHeader>

        {step.kind === "search" ? (
          <SheetBody className="flex flex-col gap-3">
            <InputGroup>
              <InputGroupAddon>
                <Search aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                autoFocus={!listenOnOpen}
                value={listening ? voice.transcript || query : query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("searchCatalog")}
                aria-label={t("searchCatalog")}
              />
              {voice.supported ? (
                <button
                  type="button"
                  onClick={listening ? voice.stop : voice.start}
                  aria-label={listening ? t("stopListening") : t("speak")}
                  aria-pressed={listening}
                  className={cn(
                    "me-1 flex size-10 shrink-0 items-center justify-center rounded-full",
                    listening ? "animate-pulse bg-action text-on-action" : "text-primary-strong",
                  )}
                >
                  <Mic aria-hidden className="size-5" />
                </button>
              ) : null}
            </InputGroup>
            {listening ? (
              <p className="text-sm font-semibold text-primary-strong">{t("listening")}</p>
            ) : null}

            <ul
              className={cn("flex flex-col divide-y divide-border/70", searching && "opacity-60")}
            >
              {(query.trim().length >= 2 ? results : []).map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => pick(product)}
                    className="flex min-h-16 w-full items-center gap-3 py-2 text-start"
                  >
                    <ProductImage
                      src={storageUrl(product.image_path)}
                      alt={product.name}
                      sizes="48px"
                      className="size-12 shrink-0 rounded-md"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-semibold text-ink">
                        {product.name}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {[product.pack_size_label, product.category_name]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    {product.mrp_paisa ? (
                      <span className="num text-sm text-muted">{formatRs(product.mrp_paisa)}</span>
                    ) : null}
                    <ChevronRight aria-hidden className="size-4 text-muted rtl:-scale-x-100" />
                  </button>
                </li>
              ))}
            </ul>

            <Button variant="soft" block onClick={own}>
              <PenLine aria-hidden />
              {t("addOwn")}
            </Button>
          </SheetBody>
        ) : (
          <SheetBody className="flex flex-col gap-5">
            {step.kind === "catalog" ? (
              <div className="flex items-center gap-3 rounded-lg bg-subtle p-3">
                <ProductImage
                  src={storageUrl(step.product.image_path)}
                  alt={step.product.name}
                  sizes="56px"
                  className="size-14 shrink-0 rounded-md"
                />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-semibold text-ink">{step.product.name}</span>
                  <span className="block text-sm text-muted">{step.product.pack_size_label}</span>
                </span>
              </div>
            ) : (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-ink">{t("name")}</span>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={160}
                    autoFocus
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-ink">{t("packSize")}</span>
                  <Input
                    value={pack}
                    onChange={(event) => setPack(event.target.value)}
                    maxLength={60}
                    placeholder={t("packSizeHint")}
                  />
                </label>
              </>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-ink">{t("sellPrice")}</span>
              <PriceField
                value={price}
                onChange={setPrice}
                label={t("sellPrice")}
                invalid={price !== "" && pricePaisa === null}
              />
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-ink">{t("onShelf")}</span>
              <QtyField value={qty} onChange={setQty} label={t("onShelf")} />
            </div>
          </SheetBody>
        )}

        {step.kind === "search" ? null : (
          <SheetFooter className="flex flex-col gap-2">
            <Button size="lg" block loading={saving} disabled={!canSave} onClick={save}>
              {t("addButton")}
            </Button>
            <Button variant="ghost" block onClick={() => setStep({ kind: "search" })}>
              {t("back")}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
