"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import {
  ArrowLeft,
  Camera,
  Check,
  ImagePlus,
  Link2,
  Mic,
  Search,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useDeferredValue, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ProductImage } from "@/components/commerce/product-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { storageUrl } from "@/features/ordering/images";
import { Link, useRouter } from "@/i18n/navigation";
import { haptic } from "@/lib/haptics";
import { resizeImage } from "@/lib/image-resize";
import { formatRs, parseRupees } from "@/lib/money";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { draftProduct, saveProduct } from "../actions";
import type { ProductDraft } from "../parse-note";
import {
  masterMatchSchema,
  type CatalogReference,
  type CatalogRow,
  type MasterMatch,
} from "../schemas";

type Fields = {
  master_product_id: string | null;
  name: string;
  name_ur: string;
  brand_id: string | null;
  category_id: string | null;
  pack_size_label: string;
  barcode: string;
  image_path: string | null;
  trade: string;
  mrp: string;
  carton: string;
  moq: string;
  stock: string;
  expiry: string;
  is_active: boolean;
};

const NONE = "none";
const rupees = (paisa: number | null | undefined) =>
  paisa === null || paisa === undefined || paisa === 0 ? "" : String(paisa / 100);

function initialFields(product?: CatalogRow): Fields {
  return {
    master_product_id: product?.master_product_id ?? null,
    name: product?.name ?? "",
    name_ur: product?.name_ur ?? "",
    brand_id: product?.brand_id ?? null,
    category_id: product?.category_id ?? null,
    pack_size_label: product?.pack_size_label ?? "",
    barcode: product?.barcode ?? "",
    image_path: product?.image_path ?? null,
    trade: rupees(product?.trade_price_paisa),
    mrp: rupees(product?.mrp_paisa),
    carton: product?.carton_qty ? String(product.carton_qty) : "",
    moq: String(product?.moq_base_qty ?? 1),
    stock: "",
    expiry: "",
    is_active: product?.is_active ?? true,
  };
}

function Field({
  id,
  label,
  hint,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/** "Find in TezDukan catalog": master products that pre-fill the form. */
function MasterSearch({ onPick }: { onPick: (match: MasterMatch) => void }) {
  const t = useTranslations("catalog.form");
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim());
  const results = useQuery({
    queryKey: ["master-search", deferred],
    enabled: deferred.length >= 2,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowserClient().rpc("search_master_products", {
        p_query: deferred,
        p_limit: 6,
      });
      if (error) throw new Error(error.message);
      return z.array(masterMatchSchema).parse(data);
    },
  });

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/70 bg-surface p-4 shadow-card">
      <div>
        <h2 className="font-heading text-lg font-bold text-ink">{t("findTitle")}</h2>
        <p className="text-sm text-muted">{t("findHint")}</p>
      </div>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute start-3.5 top-1/2 size-5 -translate-y-1/2 text-muted"
        />
        <Input
          aria-label={t("findTitle")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("findPlaceholder")}
          className="ps-11"
        />
      </div>
      {deferred.length >= 2 && results.data ? (
        results.data.length === 0 ? (
          <p className="text-sm text-muted">{t("findNone")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border/70">
            {results.data.map((match) => (
              <li key={match.id} className="flex items-center gap-3 py-2.5">
                <ProductImage
                  src={storageUrl(match.image_path)}
                  alt={match.name}
                  sizes="48px"
                  className="size-12 shrink-0 rounded-md"
                />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm font-semibold text-ink">{match.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {[match.brand_name, match.pack_size_label, match.category_name]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <Button size="sm" variant="soft" onClick={() => onPick(match)}>
                  {t("useThis")}
                </Button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}

/** Munshi: one line (or a photo of the pack) in, the whole form filled. */
function MunshiFill({ onDraft }: { onDraft: (draft: ProductDraft) => void }) {
  const t = useTranslations("catalog.form");
  const tCommon = useTranslations("common");
  const [note, setNote] = useState("");
  const [sandbox, setSandbox] = useState(false);
  const [pending, startTransition] = useTransition();
  const photoInput = useRef<HTMLInputElement>(null);

  const run = (photo?: { base64: string; mediaType: "image/jpeg" | "image/webp" }) =>
    startTransition(async () => {
      const result = await draftProduct({ note, photo });
      if (!result.ok) {
        haptic("warning");
        toast.error(result.reason === "photo_needs_ai" ? t("photoNeedsAi") : t("munshiNothing"));
        return;
      }
      onDraft(result.draft);
      setSandbox(result.mode === "sandbox");
      haptic("success");
      toast.success(t("munshiFilled"));
    });

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary-soft/60 p-4">
      <div className="flex items-start gap-3">
        <span className="sheen flex size-11 shrink-0 items-center justify-center rounded-full bg-action text-on-action inset-shadow-edge">
          <Mic aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 font-heading text-lg font-bold text-ink">
            {t("munshiTitle")}
            {sandbox ? (
              <span className="rounded-full bg-awning-soft px-2 py-0.5 text-xs font-bold text-awning-ink">
                {tCommon("sandbox")}
              </span>
            ) : null}
          </h2>
          <p className="text-sm text-ink">{t("munshiHint")}</p>
        </div>
      </div>
      <Textarea
        aria-label={t("munshiTitle")}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={t("munshiPlaceholder")}
        maxLength={1000}
        rows={2}
      />
      {sandbox ? <p className="text-xs text-ink">{t("munshiSandbox")}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <Button
          className="min-w-0 px-3"
          disabled={!note.trim()}
          loading={pending}
          onClick={() => run()}
        >
          <Sparkles aria-hidden />
          {t("munshiFill")}
        </Button>
        <Button
          variant="secondary"
          className="min-w-0 px-3"
          disabled={pending}
          onClick={() => photoInput.current?.click()}
        >
          <Camera aria-hidden />
          {t("munshiPhoto")}
        </Button>
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const image = await resizeImage(file, 1280).catch(() => null);
            if (image) run({ base64: image.base64, mediaType: image.mediaType });
          }}
        />
      </div>
    </section>
  );
}

/**
 * Add or edit a product. New products start with Munshi and the TezDukan catalog so a
 * distributor rarely types more than a price.
 */
export function ProductForm({
  orgId,
  product,
  reference,
}: {
  orgId: string;
  product?: CatalogRow;
  reference: CatalogReference;
}) {
  const t = useTranslations("catalog.form");
  const router = useRouter();
  const [fields, setFields] = useState<Fields>(() => initialFields(product));
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const photoInput = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Fields>(key: K, value: Fields[K]) =>
    setFields((current) => ({ ...current, [key]: value }));

  const tradePaisa = parseRupees(fields.trade);
  const mrpPaisa = fields.mrp.trim() ? parseRupees(fields.mrp) : 0;
  const margin =
    tradePaisa !== null && mrpPaisa !== null && mrpPaisa > 0 ? mrpPaisa - tradePaisa : null;

  const applyMaster = (match: MasterMatch) => {
    setFields((current) => ({
      ...current,
      master_product_id: match.id,
      name: match.name,
      name_ur: match.name_ur ?? current.name_ur,
      brand_id: match.brand_id ?? current.brand_id,
      category_id: match.category_id ?? current.category_id,
      pack_size_label: match.pack_size_label ?? current.pack_size_label,
      barcode: match.barcode ?? current.barcode,
      image_path: match.image_path ?? current.image_path,
      carton: match.units_per_carton ? String(match.units_per_carton) : current.carton,
      mrp: match.mrp_paisa ? rupees(match.mrp_paisa) : current.mrp,
    }));
    haptic("success");
  };

  const applyDraft = (draft: ProductDraft) => {
    const brand = draft.brand
      ? reference.brands.find((b) => b.name.toLowerCase() === draft.brand?.toLowerCase())
      : undefined;
    const category = draft.category
      ? reference.categories.find((c) => c.slug === draft.category)
      : undefined;
    setFields((current) => ({
      ...current,
      name: draft.name ?? current.name,
      name_ur: draft.name_ur ?? current.name_ur,
      brand_id: brand?.id ?? current.brand_id,
      category_id: category?.id ?? current.category_id,
      pack_size_label: draft.pack_size_label ?? current.pack_size_label,
      barcode: draft.barcode ?? current.barcode,
      trade: draft.trade_price_rupees !== null ? String(draft.trade_price_rupees) : current.trade,
      mrp: draft.mrp_rupees !== null ? String(draft.mrp_rupees) : current.mrp,
      carton: draft.carton_qty !== null ? String(draft.carton_qty) : current.carton,
      moq: draft.moq_pieces !== null ? String(draft.moq_pieces) : current.moq,
    }));
  };

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    try {
      const image = await resizeImage(file, 1024);
      const extension = image.mediaType === "image/webp" ? "webp" : "jpg";
      const path = `org/${orgId}/${crypto.randomUUID()}.${extension}`;
      const { error } = await getSupabaseBrowserClient()
        .storage.from("product-images")
        .upload(path, image.blob, { contentType: image.mediaType, upsert: false });
      if (error) throw error;
      set("image_path", path);
    } catch {
      toast.error(t("photoFailed"));
    } finally {
      setUploading(false);
    }
  };

  const submit = () => {
    if (tradePaisa === null || tradePaisa <= 0) return toast.error(t("errors.price_required"));
    if (mrpPaisa === null) return toast.error(t("errors.price_above_mrp"));
    startTransition(async () => {
      const result = await saveProduct({
        id: product?.id,
        master_product_id: fields.master_product_id,
        name: fields.name.trim(),
        name_ur: fields.name_ur.trim() || undefined,
        brand_id: fields.brand_id,
        category_id: fields.category_id,
        pack_size_label: fields.pack_size_label.trim() || undefined,
        barcode: fields.barcode.replace(/\D/g, "") || undefined,
        image_path: fields.image_path,
        trade_price_paisa: tradePaisa,
        mrp_paisa: mrpPaisa,
        moq_base_qty: Math.max(1, Number(fields.moq) || 1),
        carton_qty: fields.carton.trim() ? Number(fields.carton) : null,
        stock_in_qty: fields.stock.trim() ? Number(fields.stock) : undefined,
        stock_expiry_date: fields.expiry || undefined,
        is_active: fields.is_active,
      });
      if (!result.ok) {
        haptic("warning");
        toast.error(t(`errors.${result.error}`));
        return;
      }
      haptic("success");
      toast.success(t("saved", { name: fields.name.trim() }));
      router.push("/distributor/catalog");
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5">
      <header className="flex items-center gap-3">
        <Link
          href="/distributor/catalog"
          aria-label={t("back")}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface shadow-card"
        >
          <ArrowLeft aria-hidden className="size-5 rtl:-scale-x-100" />
        </Link>
        <h1 className="font-heading text-2xl font-extrabold text-ink">
          {product ? t("editTitle") : t("newTitle")}
        </h1>
      </header>

      {product ? null : (
        <>
          <MunshiFill onDraft={applyDraft} />
          <MasterSearch onPick={applyMaster} />
        </>
      )}

      <section className="flex flex-col gap-4 rounded-lg border border-border/70 bg-surface p-4 shadow-card">
        {fields.master_product_id ? (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-primary-strong">
            <Link2 aria-hidden className="size-3.5" />
            {t("linked")}
          </p>
        ) : null}

        <div className="flex items-center gap-4">
          <ProductImage
            src={storageUrl(fields.image_path)}
            alt={fields.name || t("photo")}
            sizes="96px"
            className="size-24 shrink-0 rounded-lg"
          />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-ink">{t("photo")}</span>
            <Button
              variant="secondary"
              size="sm"
              loading={uploading}
              onClick={() => photoInput.current?.click()}
            >
              <ImagePlus aria-hidden />
              {uploading ? t("uploading") : fields.image_path ? t("changePhoto") : t("addPhoto")}
            </Button>
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void uploadPhoto(file);
              }}
            />
          </div>
        </div>

        <Field id="p-name" label={t("name")}>
          <Input
            id="p-name"
            value={fields.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder={t("namePlaceholder")}
            maxLength={160}
          />
        </Field>
        <Field id="p-name-ur" label={t("nameUr")}>
          <Input
            id="p-name-ur"
            dir="rtl"
            lang="ur"
            value={fields.name_ur}
            onChange={(event) => set("name_ur", event.target.value)}
            maxLength={160}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field id="p-brand" label={t("brand")}>
            <Select
              value={fields.brand_id ?? NONE}
              onValueChange={(value) => set("brand_id", value === NONE ? null : value)}
            >
              <SelectTrigger id="p-brand">
                <SelectValue placeholder={t("choose")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("none")}</SelectItem>
                {reference.brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="p-category" label={t("category")}>
            <Select
              value={fields.category_id ?? NONE}
              onValueChange={(value) => set("category_id", value === NONE ? null : value)}
            >
              <SelectTrigger id="p-category">
                <SelectValue placeholder={t("choose")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("none")}</SelectItem>
                {reference.categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="p-pack" label={t("packSize")}>
            <Input
              id="p-pack"
              value={fields.pack_size_label}
              onChange={(event) => set("pack_size_label", event.target.value)}
              placeholder={t("packSizePlaceholder")}
              maxLength={40}
            />
          </Field>
          <Field id="p-barcode" label={t("barcode")}>
            <Input
              id="p-barcode"
              inputMode="numeric"
              dir="ltr"
              value={fields.barcode}
              onChange={(event) => set("barcode", event.target.value.replace(/\D/g, ""))}
              placeholder={t("barcodePlaceholder")}
              maxLength={14}
              className="num"
            />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-border/70 bg-surface p-4 shadow-card">
        <div className="grid grid-cols-2 gap-3">
          <Field id="p-trade" label={t("tradePrice")}>
            <Input
              id="p-trade"
              inputMode="decimal"
              dir="ltr"
              value={fields.trade}
              onChange={(event) => set("trade", event.target.value)}
              className="num"
            />
          </Field>
          <Field id="p-mrp" label={t("mrp")}>
            <Input
              id="p-mrp"
              inputMode="decimal"
              dir="ltr"
              value={fields.mrp}
              onChange={(event) => set("mrp", event.target.value)}
              className="num"
            />
          </Field>
        </div>
        {margin !== null && mrpPaisa ? (
          margin >= 0 ? (
            <p className="num flex items-center gap-1.5 rounded-md bg-primary-soft px-3 py-2 text-sm font-semibold text-primary-strong">
              <Check aria-hidden className="size-4" />
              {t("marginNote", {
                amount: formatRs(margin),
                percent: Math.round((margin / mrpPaisa) * 1000) / 10,
              })}
            </p>
          ) : (
            <p className="flex items-center gap-1.5 rounded-md bg-danger-soft px-3 py-2 text-sm font-semibold text-danger-ink">
              <TriangleAlert aria-hidden className="size-4" />
              {t("aboveMrp")}
            </p>
          )
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field id="p-carton" label={t("carton")} hint={t("cartonHint")}>
            <Input
              id="p-carton"
              inputMode="numeric"
              dir="ltr"
              value={fields.carton}
              onChange={(event) => set("carton", event.target.value.replace(/\D/g, ""))}
              className="num"
            />
          </Field>
          <Field id="p-moq" label={t("moq")}>
            <Input
              id="p-moq"
              inputMode="numeric"
              dir="ltr"
              value={fields.moq}
              onChange={(event) => set("moq", event.target.value.replace(/\D/g, ""))}
              className="num"
            />
          </Field>
          <Field id="p-stock" label={t("stockIn")} hint={t("stockHint")}>
            <Input
              id="p-stock"
              inputMode="numeric"
              dir="ltr"
              value={fields.stock}
              onChange={(event) => set("stock", event.target.value.replace(/\D/g, ""))}
              className="num"
            />
          </Field>
          <Field id="p-expiry" label={t("expiry")}>
            <Input
              id="p-expiry"
              type="date"
              dir="ltr"
              value={fields.expiry}
              onChange={(event) => set("expiry", event.target.value)}
              disabled={!fields.stock.trim()}
            />
          </Field>
        </div>
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-semibold text-ink">{t("active")}</span>
            <span className="block text-sm text-muted">{t("activeHint")}</span>
          </span>
          <Switch
            checked={fields.is_active}
            onCheckedChange={(value) => set("is_active", value)}
            aria-label={t("active")}
          />
        </label>
      </section>

      <div className="material sticky bottom-[calc(var(--bottom-nav-space)+10px)] z-30 rounded-2xl p-1.5 shadow-float lg:bottom-6">
        <Button
          size="lg"
          block
          loading={pending}
          disabled={uploading || fields.name.trim().length < 2 || !fields.trade.trim()}
          onClick={submit}
        >
          <Check aria-hidden />
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
