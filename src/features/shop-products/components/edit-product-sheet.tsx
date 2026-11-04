"use client";

import { Camera, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PhotoPicker } from "@/components/commerce/photo-picker";
import { ProductImage } from "@/components/commerce/product-image";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { storageUrl } from "@/features/ordering/images";
import { haptic } from "@/lib/haptics";
import { formatRs, parseRupees } from "@/lib/money";
import { removeProduct, setProductImage, updateProduct } from "../actions";
import type { ShopProduct } from "../schemas";
import { PriceField, QtyField, rupeesText } from "./fields";

/** Change one product's price, stock and whether customers see it. */
export function EditProductSheet({
  product,
  shopId,
  onClose,
}: {
  product: ShopProduct;
  shopId: string;
  onClose: () => void;
}) {
  const t = useTranslations("shopProducts");
  const [photo, setPhoto] = useState<string | null>(storageUrl(product.image_path));

  const photoUploaded = (path: string, preview: string) => {
    setPhoto(preview);
    startTransition(async () => {
      const result = await setProductImage(product.id, path);
      if (!result.ok) {
        toast.error(t("photo.failed"));
        return;
      }
      haptic("success");
      toast.success(t("photo.saved"));
    });
  };
  const [price, setPrice] = useState(rupeesText(product.selling_price_paisa));
  const [qty, setQty] = useState(Math.max(0, Math.floor(product.qty_on_hand)));
  const [online, setOnline] = useState(product.is_visible_online);
  const [pending, startTransition] = useTransition();
  const pricePaisa = parseRupees(price);

  const save = () =>
    startTransition(async () => {
      if (pricePaisa === null) return;
      const result = await updateProduct({
        id: product.id,
        selling_price_paisa: pricePaisa,
        qty,
        is_visible_online: online,
      });
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      haptic("success");
      toast.success(t("saved", { name: product.name }));
      onClose();
    });

  const remove = () =>
    startTransition(async () => {
      const result = await removeProduct(product.id);
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      haptic("warning");
      toast(t("removed", { name: product.name }));
      onClose();
    });

  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent>
        <SheetHeader>
          <div className="flex items-center gap-3">
            <PhotoPicker
              bucket="product-images"
              folder={`shop/${shopId}/products`}
              label={photo ? t("photo.change") : t("photo.add")}
              onUploaded={photoUploaded}
              onError={() => toast.error(t("photo.failed"))}
              className="shrink-0 rounded-md"
            >
              <ProductImage
                src={photo}
                alt={product.name}
                sizes="80px"
                className="size-20 rounded-md"
              />
              <span className="absolute -end-1 -bottom-1 flex size-8 items-center justify-center rounded-full bg-action text-on-action shadow-raised">
                <Camera aria-hidden className="size-4" strokeWidth={1.75} />
              </span>
            </PhotoPicker>
            <div className="min-w-0 text-start">
              <SheetTitle className="line-clamp-2">{product.name}</SheetTitle>
              <SheetDescription>
                {[
                  product.pack_size_label,
                  product.mrp_paisa ? t("mrp", { price: formatRs(product.mrp_paisa) }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">{t("sellPrice")}</span>
            <PriceField
              value={price}
              onChange={setPrice}
              label={t("sellPrice")}
              invalid={pricePaisa === null}
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">{t("onShelf")}</span>
            <QtyField value={qty} onChange={setQty} label={t("onShelf")} />
          </div>
          <label className="flex min-h-12 items-center justify-between gap-3 rounded-lg bg-subtle px-4 py-3">
            <span>
              <span className="block font-semibold text-ink">{t("showOnline")}</span>
              <span className="block text-sm text-muted">{t("showOnlineHint")}</span>
            </span>
            <Switch checked={online} onCheckedChange={setOnline} aria-label={t("showOnline")} />
          </label>
        </SheetBody>
        <SheetFooter className="flex flex-col gap-2">
          <Button size="lg" block loading={pending} disabled={pricePaisa === null} onClick={save}>
            {t("save")}
          </Button>
          <Button
            variant="ghost"
            block
            disabled={pending}
            onClick={remove}
            className="text-danger-ink"
          >
            <Trash2 aria-hidden />
            {t("remove")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
