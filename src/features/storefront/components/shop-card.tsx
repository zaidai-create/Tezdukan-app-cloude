import { Bike, Clock3, MessageSquareShare, Phone } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { cn } from "cn";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { storageUrl } from "@/features/ordering/images";
import { Link } from "@/i18n/navigation";
import { telHref, whatsappHref } from "@/lib/contact";
import { formatRs } from "@/lib/money";
import type { NearbyShop } from "../schemas";

const contact =
  "flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong";

/** A dukan in a list: photo, name, area, delivery time and terms, Call and WhatsApp. */
export async function ShopCard({ shop, compact = false }: { shop: NearbyShop; compact?: boolean }) {
  const [t, locale] = await Promise.all([getTranslations("storefront"), getLocale()]);
  const area = locale === "ur" && shop.area_name_ur ? shop.area_name_ur : shop.area_name;
  const tel = telHref(shop.phone);
  const wa = whatsappHref(shop.whatsapp ?? shop.phone);

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border/60 bg-surface p-3 shadow-card",
        compact && "w-64 shrink-0 snap-start",
      )}
    >
      <Link href={`/shops/${shop.slug}`} className="flex items-center gap-3">
        <Avatar className="size-14 rounded-md">
          {shop.photo_path ? (
            <AvatarImage src={storageUrl(shop.photo_path, "shop-media") ?? undefined} alt="" />
          ) : null}
          <AvatarFallback name={shop.name} className="rounded-md text-base" />
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-heading text-base font-semibold text-ink">
            {shop.name}
          </span>
          <span className="block truncate text-sm text-muted">{area ?? shop.address_line}</span>
        </span>
      </Link>
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        {shop.is_live ? (
          <>
            {shop.eta_minutes ? (
              <span className="num inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 font-semibold text-primary-strong">
                <Clock3 aria-hidden className="size-3.5" />
                {t("eta", { minutes: shop.eta_minutes })}
              </span>
            ) : null}
            <span className="num inline-flex items-center gap-1 rounded-full bg-subtle px-2.5 py-1 font-medium text-ink">
              <Bike aria-hidden className="size-3.5" />
              {shop.delivery_fee_paisa === 0
                ? t("freeDelivery")
                : t("deliveryFee", { amount: formatRs(shop.delivery_fee_paisa) })}
            </span>
          </>
        ) : (
          <span className="rounded-full bg-awning-soft px-2.5 py-1 font-semibold text-awning-ink">
            {t("callToOrder")}
          </span>
        )}
      </div>
      {compact ? null : (
        <div className="flex items-center gap-2">
          {shop.is_live ? (
            <Link
              href={`/shops/${shop.slug}`}
              className="sheen flex h-11 flex-1 items-center justify-center rounded-md bg-action px-4 text-sm font-semibold text-on-action shadow-glow inset-shadow-edge"
            >
              {t("openShop")}
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          {tel ? (
            <a href={tel} className={contact} aria-label={`${t("call")}: ${shop.name}`}>
              <Phone aria-hidden className="size-5" />
            </a>
          ) : null}
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className={contact}
              aria-label={`${t("whatsapp")}: ${shop.name}`}
            >
              <MessageSquareShare aria-hidden className="size-5" />
            </a>
          ) : null}
        </div>
      )}
    </article>
  );
}
