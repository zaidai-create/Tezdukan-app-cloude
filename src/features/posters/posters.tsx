import {
  BadgeCheck,
  Banknote,
  BellRing,
  Bike,
  PackagePlus,
  Percent,
  Truck,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Poster } from "@/components/posters/poster";
import { PosterCarousel } from "@/components/posters/poster-carousel";

/** Posters on the customer home: shop nearby, follow orders, and (once) sell on TezDukan. */
export async function CustomerPosters({ showSell }: { showSell: boolean }) {
  const t = await getTranslations("posters");
  return (
    <PosterCarousel label={t("label")}>
      <Poster
        tone="forest"
        priority
        eyebrow={t("customer.nearby.eyebrow")}
        title={t("customer.nearby.title")}
        body={t("customer.nearby.body")}
        cta={{ href: "/shops", label: t("customer.nearby.cta") }}
        screen="/posters/customer-shop.webp"
        chips={[
          { icon: Bike, title: t("chips.onTheWay"), sub: t("chips.onTheWaySub") },
          { icon: Banknote, title: t("chips.cashOnDelivery") },
        ]}
      />
      <Poster
        tone="mint"
        eyebrow={t("customer.track.eyebrow")}
        title={t("customer.track.title")}
        body={t("customer.track.body")}
        cta={{ href: "/orders", label: t("customer.track.cta") }}
        screen="/posters/customer-orders.webp"
        chips={[{ icon: BadgeCheck, title: t("chips.accepted"), sub: t("chips.acceptedSub") }]}
      />
      {showSell ? (
        <Poster
          tone="awning"
          eyebrow={t("customer.sell.eyebrow")}
          title={t("customer.sell.title")}
          body={t("customer.sell.body")}
          cta={{ href: "/start/dukan", label: t("customer.sell.cta") }}
          screen="/posters/dukan-dashboard.webp"
          chips={[{ icon: BellRing, title: t("chips.newOrder"), sub: t("chips.newOrderSub") }]}
        />
      ) : null}
    </PosterCarousel>
  );
}

/** Posters on the dukandar's home: fill the shelf fast, and buy stock at trade price. */
export async function DukanPosters() {
  const t = await getTranslations("posters");
  return (
    <PosterCarousel label={t("label")}>
      <Poster
        tone="mint"
        eyebrow={t("dukan.products.eyebrow")}
        title={t("dukan.products.title")}
        body={t("dukan.products.body")}
        cta={{ href: "/dukan/products", label: t("dukan.products.cta") }}
        screen="/posters/dukan-products.webp"
        chips={[{ icon: PackagePlus, title: t("chips.added"), sub: t("chips.addedSub") }]}
      />
      <Poster
        tone="awning"
        eyebrow={t("dukan.wholesale.eyebrow")}
        title={t("dukan.wholesale.title")}
        body={t("dukan.wholesale.body")}
        cta={{ href: "/dukan/wholesale", label: t("dukan.wholesale.cta") }}
        screen="/posters/dukan-wholesale.webp"
        chips={[
          { icon: Percent, title: t("chips.margin"), sub: t("chips.marginSub") },
          { icon: Truck, title: t("chips.delivery") },
        ]}
      />
    </PosterCarousel>
  );
}

/** Posters on the distributor's dashboard: list products fast, and run orders in one inbox. */
export async function DistributorPosters() {
  const t = await getTranslations("posters");
  return (
    <PosterCarousel label={t("label")}>
      <Poster
        tone="mint"
        eyebrow={t("distributor.catalog.eyebrow")}
        title={t("distributor.catalog.title")}
        body={t("distributor.catalog.body")}
        cta={{ href: "/distributor/catalog", label: t("distributor.catalog.cta") }}
        screen="/posters/distributor-dashboard.webp"
        chips={[{ icon: PackagePlus, title: t("chips.listed"), sub: t("chips.listedSub") }]}
      />
      <Poster
        tone="awning"
        eyebrow={t("distributor.orders.eyebrow")}
        title={t("distributor.orders.title")}
        body={t("distributor.orders.body")}
        cta={{ href: "/distributor/orders", label: t("distributor.orders.cta") }}
        screen="/posters/distributor-orders.webp"
        chips={[
          { icon: BellRing, title: t("chips.newOrder"), sub: t("chips.fromDukan") },
          { icon: Wallet, title: t("chips.cashCollected") },
        ]}
      />
    </PosterCarousel>
  );
}
