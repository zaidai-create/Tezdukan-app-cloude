import { Bike, Clock3, MessageSquareShare, Phone, ShoppingBag } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Awning } from "@/components/brand/awning";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { storageUrl } from "@/features/ordering/images";
import { telHref, whatsappHref } from "@/lib/contact";
import { formatRs } from "@/lib/money";
import type { StorefrontShop } from "../schemas";

const pill = "num inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold";

/** A dukan's storefront header: signboard, delivery terms and contact. */
export async function ShopHeader({ shop }: { shop: StorefrontShop }) {
  const [t, locale] = await Promise.all([getTranslations("storefront"), getLocale()]);
  const area = locale === "ur" && shop.area_name_ur ? shop.area_name_ur : shop.area_name;
  const tel = telHref(shop.phone);
  const wa = whatsappHref(shop.whatsapp ?? shop.phone);

  return (
    <header className="overflow-hidden rounded-xl border border-border/60 bg-surface shadow-raised">
      <Awning className="text-awning" height={16} />
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-4">
          <Avatar className="size-16 rounded-lg">
            {shop.photo_path ? (
              <AvatarImage src={storageUrl(shop.photo_path, "shop-media") ?? undefined} alt="" />
            ) : null}
            <AvatarFallback name={shop.name} className="rounded-lg text-lg" />
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-heading text-2xl font-bold text-ink">{shop.name}</h1>
            <p className="truncate text-sm text-muted">
              {[area, shop.address_line].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        {shop.tagline ? <p className="text-base text-ink/80">{shop.tagline}</p> : null}
        {shop.is_live ? (
          <div className="flex flex-wrap gap-1.5">
            {shop.eta_minutes ? (
              <span className={`${pill} bg-primary-soft text-primary-strong`}>
                <Clock3 aria-hidden className="size-3.5" />
                {t("eta", { minutes: shop.eta_minutes })}
              </span>
            ) : null}
            <span className={`${pill} bg-subtle text-ink`}>
              <Bike aria-hidden className="size-3.5" />
              {shop.delivery_fee_paisa === 0
                ? t("freeDelivery")
                : t("deliveryFee", { amount: formatRs(shop.delivery_fee_paisa) })}
            </span>
            {shop.min_order_paisa > 0 ? (
              <span className={`${pill} bg-subtle text-ink`}>
                <ShoppingBag aria-hidden className="size-3.5" />
                {t("shop.minOrder", { amount: formatRs(shop.min_order_paisa) })}
              </span>
            ) : null}
            {shop.free_delivery_above_paisa ? (
              <span className={`${pill} bg-awning-soft text-awning-ink`}>
                {t("shop.freeAbove", { amount: formatRs(shop.free_delivery_above_paisa) })}
              </span>
            ) : null}
          </div>
        ) : null}
        {tel || wa ? (
          <div className="grid grid-cols-2 gap-2">
            {tel ? (
              <a
                href={tel}
                className="flex h-12 items-center justify-center gap-2 rounded-md bg-primary-soft font-semibold text-primary-strong"
              >
                <Phone aria-hidden className="size-5" />
                {t("call")}
              </a>
            ) : null}
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 items-center justify-center gap-2 rounded-md bg-primary-soft font-semibold text-primary-strong"
              >
                <MessageSquareShare aria-hidden className="size-5" />
                {t("whatsapp")}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
