"use client";

import { Camera, ImagePlus, Loader2, Store } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Awning } from "@/components/brand/awning";
import { PhotoPicker } from "@/components/commerce/photo-picker";
import { Textarea } from "@/components/ui/textarea";
import { storageUrl } from "@/features/ordering/images";
import { haptic } from "@/lib/haptics";
import { saveShopProfile } from "../actions";
import type { ShopStorefront } from "../schemas";

/**
 * The dukan's shop front, like a Daraz store page: a wide banner, a round logo and a few lines
 * about the dukan. Photos save as soon as they are picked; the text saves with its button.
 */
export function ShopProfile({ store }: { store: ShopStorefront }) {
  const t = useTranslations("onlineDukan.profile");
  const [cover, setCover] = useState(storageUrl(store.cover_path, "shop-media"));
  const [logo, setLogo] = useState(storageUrl(store.photo_path, "shop-media"));
  const [about, setAbout] = useState(store.description ?? "");
  const [pending, startTransition] = useTransition();
  const folder = `shop/${store.shop_id}`;

  const save = (input: Parameters<typeof saveShopProfile>[0], done: string) =>
    startTransition(async () => {
      const result = await saveShopProfile(input);
      if (!result.ok) {
        haptic("warning");
        toast.error(t("failed"));
        return;
      }
      haptic("success");
      toast.success(done);
    });

  const failed = () => toast.error(t("uploadFailed"));

  return (
    <section className="overflow-hidden rounded-xl border border-border/60 bg-surface shadow-card">
      <div className="relative aspect-[16/7] w-full bg-primary-soft">
        {cover ? (
          <Image
            src={cover}
            alt=""
            fill
            sizes="(min-width: 768px) 640px, 100vw"
            unoptimized={cover.startsWith("blob:")}
            className="object-cover"
          />
        ) : (
          <div className="flex size-full flex-col">
            <Awning className="text-awning" height={18} />
            <p className="flex flex-1 items-center justify-center px-6 text-center text-sm font-semibold text-primary-strong">
              {t("bannerHint")}
            </p>
          </div>
        )}
        {store.can_edit ? (
          <PhotoPicker
            bucket="shop-media"
            folder={`${folder}/banner`}
            maxSide={1600}
            label={cover ? t("changeBanner") : t("addBanner")}
            onUploaded={(path, preview) => {
              setCover(preview);
              save({ coverPath: path }, t("bannerSaved"));
            }}
            onError={failed}
            className="absolute end-3 bottom-3 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface px-4 text-sm font-semibold text-ink shadow-raised"
          >
            <ImagePlus aria-hidden className="size-4" strokeWidth={1.75} />
            {cover ? t("changeBanner") : t("addBanner")}
          </PhotoPicker>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 px-4 pb-4">
        <div className="-mt-10 flex items-end gap-3">
          {store.can_edit ? (
            <PhotoPicker
              bucket="shop-media"
              folder={`${folder}/logo`}
              maxSide={600}
              label={logo ? t("changeLogo") : t("addLogo")}
              onUploaded={(path, preview) => {
                setLogo(preview);
                save({ photoPath: path }, t("logoSaved"));
              }}
              onError={failed}
              className="shrink-0 rounded-2xl"
            >
              <LogoTile src={logo} name={store.name} />
              <span className="absolute -end-1 -bottom-1 flex size-8 items-center justify-center rounded-full bg-action text-on-action shadow-raised">
                <Camera aria-hidden className="size-4" strokeWidth={1.75} />
              </span>
            </PhotoPicker>
          ) : (
            <LogoTile src={logo} name={store.name} />
          )}
          <div className="min-w-0 pb-1">
            <h2 className="truncate font-heading text-xl font-bold text-ink">{store.name}</h2>
            <p className="text-sm text-muted">{t("subtitle")}</p>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">{t("about")}</span>
          <Textarea
            value={about}
            maxLength={500}
            dir="auto"
            rows={3}
            disabled={!store.can_edit}
            placeholder={t("aboutPlaceholder")}
            onChange={(event) => setAbout(event.target.value)}
          />
        </label>
        {store.can_edit ? (
          <button
            type="button"
            disabled={pending || about === (store.description ?? "")}
            onClick={() => save({ description: about }, t("aboutSaved"))}
            className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary-soft px-4 font-semibold text-primary-strong disabled:opacity-50"
          >
            {pending ? <Loader2 aria-hidden className="size-5 animate-spin" /> : null}
            {t("saveAbout")}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function LogoTile({ src, name }: { src: string | null; name: string }) {
  return (
    <span className="relative block size-20 overflow-hidden rounded-2xl border-4 border-surface bg-surface shadow-raised">
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes="80px"
          unoptimized={src.startsWith("blob:")}
          className="object-cover"
        />
      ) : (
        // No initials here: the tile is a button labelled "Add logo", and text inside it would
        // have to match that label.
        <span
          title={name}
          className="flex size-full items-center justify-center bg-primary-soft text-primary-strong"
        >
          <Store className="size-8" strokeWidth={1.75} />
        </span>
      )}
    </span>
  );
}
