"use client";

import { CircleAlert, Plus, ShoppingBasket, Store, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { AddToCart } from "@/components/commerce/add-to-cart";
import { ProductImage } from "@/components/commerce/product-image";
import { EmptyState } from "@/components/states/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import type { SavedAddress } from "@/features/addresses/schemas";
import { placeCustomerOrder } from "@/features/customer-orders/actions";
import { storageUrl } from "@/features/ordering/images";
import { Link, useRouter } from "@/i18n/navigation";
import { haptic } from "@/lib/haptics";
import { formatRs } from "@/lib/money";
import { useCustomerCart, type CartLine } from "../cart-store";
import type { DeliveryZone, NearbyShop } from "../schemas";
import { AddressSection } from "./checkout/address-section";
import {
  InstructionsSection,
  PaymentSection,
  UnavailableSection,
} from "./checkout/instructions-section";

type Group = { shopId: string; shopName: string; shopSlug: string; lines: CartLine[] };

function groupByShop(lines: readonly CartLine[]): Group[] {
  const groups = new Map<string, Group>();
  for (const line of lines) {
    const group = groups.get(line.shopId) ?? {
      shopId: line.shopId,
      shopName: line.shopName,
      shopSlug: line.shopSlug,
      lines: [],
    };
    group.lines.push(line);
    groups.set(line.shopId, group);
  }
  return [...groups.values()];
}

/** One dukan's bill: items, delivery (free above its threshold), savings and the minimum. */
function billFor(group: Group, shop: NearbyShop | undefined) {
  const itemTotal = group.lines.reduce((sum, line) => sum + line.pricePaisa * line.quantity, 0);
  const savings = group.lines.reduce(
    (sum, line) =>
      sum + Math.max((line.mrpPaisa ?? line.pricePaisa) - line.pricePaisa, 0) * line.quantity,
    0,
  );
  const freeAbove = shop?.free_delivery_above_paisa ?? null;
  const fee = freeAbove !== null && itemTotal >= freeAbove ? 0 : (shop?.delivery_fee_paisa ?? 0);
  const minOrder = shop?.min_order_paisa ?? 0;
  return {
    itemTotal,
    savings,
    freeAbove,
    fee,
    minOrder,
    short: Math.max(minOrder - itemTotal, 0),
    total: itemTotal + fee,
  };
}

/**
 * Whether this dukan can take the order at the chosen address. The list of nearby dukans is
 * already filtered by that address, so a dukan missing from it does not deliver there.
 */
type Reach = "ok" | "out" | "closed" | "unknown";
function reachOf(shop: NearbyShop | undefined, address: SavedAddress | null): Reach {
  if (!address) return "unknown";
  if (!shop) return "out";
  return shop.is_live ? "ok" : "closed";
}

/** Places one dukan's part of the cart at the chosen address, with instructions and note. */
function usePlaceOrder(group: Group, address: SavedAddress | null) {
  const t = useTranslations("storefront.cart");
  const tOrders = useTranslations("customerOrders");
  const router = useRouter();
  const clearShop = useCustomerCart((state) => state.clearShop);
  const [placing, startPlacing] = useTransition();
  // One id per attempt, so a retried tap never places the order twice.
  const requestId = useRef<string>(crypto.randomUUID());

  const place = () => {
    const state = useCustomerCart.getState();
    if (!address) {
      haptic("warning");
      toast.error(t("addressNeeded"));
      const section = document.getElementById("cart-address");
      section?.scrollIntoView({ block: "center" });
      section?.focus({ preventScroll: true });
      return;
    }
    const note = [...state.instructions.map((item) => t(`instructions.${item}`)), state.note.trim()]
      .filter(Boolean)
      .join(". ")
      .slice(0, 300);
    startPlacing(async () => {
      const result = await placeCustomerOrder({
        shopId: group.shopId,
        items: group.lines.map((line) => ({ inventoryId: line.id, qty: line.quantity })),
        addressId: address.id,
        note: note || undefined,
        requestId: requestId.current,
        ifUnavailable: state.ifUnavailable,
      });
      if (!result.ok) {
        haptic("warning");
        toast.error(tOrders(`errors.${result.error}`));
        return;
      }
      haptic("success");
      requestId.current = crypto.randomUUID();
      clearShop(group.shopId);
      router.push(`/orders/${result.data.id}?placed=1`);
    });
  };
  return { place, placing };
}

/** The shopper's cart: address, one card per dukan, instructions, payment, and Place order. */
export function CartView({
  shops,
  addresses,
  zones,
  selectedAddressId,
}: {
  /** Dukans that deliver to the chosen delivery point. */
  shops: NearbyShop[];
  addresses: SavedAddress[];
  zones: DeliveryZone[];
  selectedAddressId: string | null;
}) {
  const t = useTranslations("storefront.cart");
  const lines = useCustomerCart((state) => state.lines);
  const groups = groupByShop(lines);
  // Orders need a pin; an older address without one has to be placed on the map first.
  const address =
    addresses.find(
      (candidate) =>
        candidate.id === selectedAddressId && candidate.lat !== null && candidate.lng !== null,
    ) ?? null;

  if (groups.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <EmptyState
          icon={ShoppingBasket}
          title={t("empty")}
          description={t("emptyHint")}
          action={
            <Link href="/" className={buttonVariants({ size: "lg" })}>
              {t("startShopping")}
            </Link>
          }
        />
      </div>
    );
  }

  const single = groups.length === 1 ? groups[0] : undefined;
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink lg:text-3xl">{t("title")}</h1>
          <p className="num text-sm text-muted">{t("itemsCount", { count })}</p>
        </div>
        {groups.length > 1 ? (
          <p className="max-w-48 text-end text-xs text-muted">{t("multiShop")}</p>
        ) : null}
      </header>

      <AddressSection addresses={addresses} zones={zones} selected={address} />

      {groups.map((group) => (
        <ShopCartCard
          key={group.shopId}
          group={group}
          shop={shops.find((shop) => shop.id === group.shopId)}
          address={address}
          ownButton={!single}
        />
      ))}

      <UnavailableSection />
      <InstructionsSection />
      <PaymentSection />

      {single ? (
        <SinglePlaceBar
          group={single}
          shop={shops.find((shop) => shop.id === single.shopId)}
          address={address}
        />
      ) : null}
    </div>
  );
}

/** The always-visible "Place order · Rs 1,070" bar when the cart is from one dukan. */
function SinglePlaceBar({
  group,
  shop,
  address,
}: {
  group: Group;
  shop: NearbyShop | undefined;
  address: SavedAddress | null;
}) {
  const t = useTranslations("storefront.cart");
  const bill = billFor(group, shop);
  const reach = reachOf(shop, address);
  const blocked = reach === "out" || reach === "closed";
  const { place, placing } = usePlaceOrder(group, address);
  return (
    <StickyActionBar>
      <Button
        size="lg"
        block
        loading={placing}
        disabled={bill.short > 0 || blocked}
        onClick={place}
      >
        <span className="num">
          {bill.short > 0
            ? t("addMoreToOrder", { amount: formatRs(bill.short) })
            : t("placeOrder", { total: formatRs(bill.total) })}
        </span>
      </Button>
    </StickyActionBar>
  );
}

function ShopCartCard({
  group,
  shop,
  address,
  ownButton,
}: {
  group: Group;
  shop: NearbyShop | undefined;
  address: SavedAddress | null;
  ownButton: boolean;
}) {
  const t = useTranslations("storefront.cart");
  const tShop = useTranslations("storefront");
  const locale = useLocale();
  const setQuantity = useCustomerCart((state) => state.setQuantity);
  const clearShop = useCustomerCart((state) => state.clearShop);
  const bill = billFor(group, shop);
  const reach = reachOf(shop, address);
  const blocked = reach === "out" || reach === "closed";
  const { place, placing } = usePlaceOrder(group, address);

  return (
    <section className="overflow-hidden rounded-lg border border-border/60 bg-surface shadow-card">
      <header className="flex items-center gap-3 border-b border-border/70 px-4 py-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
          <Store aria-hidden className="size-5" strokeWidth={1.75} />
        </span>
        <Link href={`/shops/${group.shopSlug}`} className="min-w-0 flex-1">
          <span className="block truncate font-heading text-lg font-semibold text-ink">
            {group.shopName}
          </span>
          {shop?.eta_minutes ? (
            <span className="num block text-sm text-muted">
              {tShop("eta", { minutes: shop.eta_minutes })}
            </span>
          ) : null}
        </Link>
        <Link
          href={`/shops/${group.shopSlug}`}
          className="inline-flex min-h-10 items-center gap-1 rounded-full bg-subtle px-3 text-sm font-semibold text-ink"
        >
          <Plus aria-hidden className="size-4" />
          {t("addMore")}
        </Link>
      </header>

      <ul className="divide-y divide-border/70">
        {group.lines.map((line) => (
          <li key={line.id} className="flex items-center gap-3 px-4 py-3">
            <ProductImage
              src={storageUrl(line.imagePath)}
              alt={line.name}
              className="size-16 shrink-0 rounded-md"
            />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-semibold text-pretty text-ink">{line.name}</p>
              <p className="num flex items-baseline gap-1.5 text-sm">
                <span className="font-semibold text-ink">{formatRs(line.pricePaisa)}</span>
                {line.mrpPaisa && line.mrpPaisa > line.pricePaisa ? (
                  <span className="text-xs text-muted line-through">{formatRs(line.mrpPaisa)}</span>
                ) : null}
              </p>
            </div>
            <AddToCart
              quantity={line.quantity}
              onQuantityChange={(next) =>
                setQuantity(
                  {
                    id: line.id,
                    shop_id: line.shopId,
                    shop_name: line.shopName,
                    shop_slug: line.shopSlug,
                    name: line.name,
                    name_ur: null,
                    pack_size_label: line.packSize,
                    unit: "pc",
                    is_loose: false,
                    selling_price_paisa: line.pricePaisa,
                    mrp_paisa: line.mrpPaisa,
                    category_id: null,
                    is_favourite: false,
                    in_stock: true,
                    low_stock: false,
                    image_path: line.imagePath,
                  },
                  next,
                )
              }
              productName={line.name}
            />
          </li>
        ))}
      </ul>

      {blocked ? (
        <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-4">
          <p
            role="status"
            className="flex items-start gap-2 rounded-md bg-awning-soft px-3 py-2.5 text-sm font-semibold text-awning-ink"
          >
            <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
            {reach === "out"
              ? t("notDelivering", { shop: group.shopName })
              : t("notOpen", { shop: group.shopName })}
          </p>
          <Button variant="secondary" onClick={() => clearShop(group.shopId)}>
            <Trash2 aria-hidden />
            {t("removeItems")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-4">
          {bill.freeAbove !== null && bill.fee > 0 ? (
            <div className="flex flex-col gap-1.5">
              <p className="num text-sm font-semibold text-primary-strong">
                {t("addMoreForFree", { amount: formatRs(bill.freeAbove - bill.itemTotal) })}
              </p>
              <Progress value={Math.min((bill.itemTotal / bill.freeAbove) * 100, 100)} />
            </div>
          ) : bill.freeAbove !== null ? (
            <p className="text-sm font-semibold text-primary-strong">{t("freeUnlocked")}</p>
          ) : null}

          <dl
            className="num flex flex-col gap-1.5 text-base"
            dir={locale === "ur" ? "rtl" : undefined}
          >
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t("itemTotal")}</dt>
              <dd className="text-ink">{formatRs(bill.itemTotal)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t("delivery")}</dt>
              <dd className={bill.fee === 0 ? "font-semibold text-primary-strong" : "text-ink"}>
                {bill.fee === 0 ? t("free") : formatRs(bill.fee)}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-border/70 pt-2 font-heading text-lg font-bold">
              <dt className="text-ink">{t("toPay")}</dt>
              <dd className="text-ink">{formatRs(bill.total)}</dd>
            </div>
          </dl>
          {bill.savings > 0 ? (
            <p className="num rounded-md bg-primary-soft px-3 py-2 text-sm font-semibold text-primary-strong">
              {t("savings", { amount: formatRs(bill.savings) })}
            </p>
          ) : null}
          {bill.short > 0 ? (
            <p className="rounded-md bg-awning-soft px-3 py-2 text-sm font-semibold text-awning-ink">
              {t("belowMin", { amount: formatRs(bill.minOrder), short: formatRs(bill.short) })}
            </p>
          ) : null}
          {ownButton ? (
            <Button size="lg" block loading={placing} disabled={bill.short > 0} onClick={place}>
              <span className="num">{t("placeOrder", { total: formatRs(bill.total) })}</span>
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}
