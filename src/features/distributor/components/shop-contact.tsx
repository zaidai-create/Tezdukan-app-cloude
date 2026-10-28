import { cn } from "cn";
import { MapPin, MessageCircle, MessageSquareShare, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { mapsHref, telHref, whatsappHref } from "@/lib/contact";
import type { ShopCard } from "../schemas";

// Icon over label in equal columns: four actions fit a phone without squeezing a label out.
const action =
  "flex h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 text-sm font-semibold transition-colors";

/** Call, WhatsApp, chat and map buttons for a dukan: the distributor's one-tap contact row. */
export async function ShopContact({
  shop,
  whatsappText,
  chatHref,
  className,
}: {
  shop: ShopCard;
  whatsappText?: string;
  chatHref?: string;
  className?: string;
}) {
  const t = await getTranslations("distributor.order.shop");
  const tel = telHref(shop.phone);
  const wa = whatsappHref(shop.whatsapp, whatsappText);
  const map = mapsHref(shop.lat, shop.lng);

  return (
    <div className={cn("grid auto-cols-fr grid-flow-col gap-2", className)}>
      {tel ? (
        <a
          href={tel}
          className={cn(action, "sheen bg-action text-on-action shadow-glow inset-shadow-edge")}
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
          className={cn(action, "bg-primary-soft text-primary-strong hover:bg-subtle")}
        >
          <MessageSquareShare aria-hidden className="size-5" />
          {t("whatsapp")}
        </a>
      ) : null}
      {chatHref ? (
        <Link href={chatHref} className={cn(action, "bg-subtle text-ink hover:bg-subtle-strong")}>
          <MessageCircle aria-hidden className="size-5" />
          {t("chat")}
        </Link>
      ) : null}
      {map ? (
        <a
          href={map}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(action, "bg-subtle text-ink hover:bg-subtle-strong")}
        >
          <MapPin aria-hidden className="size-5" />
          {t("map")}
        </a>
      ) : null}
    </div>
  );
}
