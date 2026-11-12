"use client";

import {
  ChevronRight,
  CircleAlert,
  MapPin,
  Plus,
  ShoppingBasket,
  Store,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
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
import { useCustomerCart } from "../cart-store";
import type { DeliveryZone, NearbyShop } from "../schemas";
import { AddressSection } from "./checkout/address-section";
import { type CartGroup, billFor, changeNotesFor, groupByShop, reachOf } from "./checkout/bill";
import { BillCard, CancellationPolicy } from "./checkout/bill-section";
import { ForgetRow } from "./checkout/forget-row";
import {
  InstructionsSection,
  PaymentSection,
  UnavailableSection,
} from "./checkout/instructions-section";

/** Brings a checkout section into view and moves focus to it (for keyboards and readers). */
function reveal(id: string) {
  const section = document.getElementById(id);
  section?.scrollIntoView({ block: "center", behavior: "smooth" });
  section?.focus({ preventScroll: true });
}

/** Places one dukan's part of the cart at the chosen address, with instructions and note. */
function usePlaceOrder(group: CartGroup, address: SavedAddress | null, total: number) {
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
      reveal("cart-address");
      return;
    }
    // Change only matters for a note larger than this order's bill.
    const note = Number(state.cashNote);
    const change =
      Number.isFinite(note) && changeNotesFor(total).includes(note)
        ? t("cashChange.forDukan", { amount: formatRs(note * 100) })
        : "";
    const text = [
      ...state.instructions.map((item) => t(`instructions.${item}`)),
      change,
      state.note.trim(),
    ]
      .filter(Boolean)
      .join(". ")
      .slice(0, 300);
    startPlacing(async () => {
      const result = await placeCustomerOrder({
        shopId: group.shopId,
        items: group.lines.map((line) => ({ inventoryId: line.id, qty: line.quantity })),
        addressId: address.id,
        note: text || undefined,
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

/**
 * Checkout, in the order a shopper thinks: where it goes, what is in it (and what they may have
 * forgotten), what to do if something is missing, how they pay, then the bill and the
 * cancellation rule, with the total and Place order always at hand. One dukan = one order;
 * a cart from several dukans places one order each.
 */
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

  const shopOf = (group: CartGroup) => shops.find((shop) => shop.id === group.shopId);
  const single = groups.length === 1 ? groups[0] : undefined;
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  // Change is asked once, against the largest bill (with several dukans, each pays its own).
  const largest = Math.max(...groups.map((group) => billFor(group, shopOf(group)).total));

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
        <div key={group.shopId} className="flex flex-col gap-4">
          <ShopItemsCard group={group} shop={shopOf(group)} address={address} />
          <ForgetRow group={group} />
        </div>
      ))}

      <UnavailableSection />
      <InstructionsSection />
      <PaymentSection total={largest} />

      {groups.map((group) => (
        <GroupBill
          key={group.shopId}
          group={group}
          shop={shopOf(group)}
          address={address}
          single={Boolean(single)}
        />
      ))}

      <CancellationPolicy />

      {single ? <PlaceBar group={single} shop={shopOf(single)} address={address} /> : null}
    </div>
  );
}

/** One dukan's bill; with several dukans it carries that dukan's own Place order. */
function GroupBill({
  group,
  shop,
  address,
  single,
}: {
  group: CartGroup;
  shop: NearbyShop | undefined;
  address: SavedAddress | null;
  single: boolean;
}) {
  const t = useTranslations("storefront.cart");
  const bill = billFor(group, shop);
  const reach = reachOf(shop, address);
  const { place, placing } = usePlaceOrder(group, address, bill.total);
  if (reach === "out" || reach === "closed") return null;
  return (
    <BillCard
      id={single ? "cart-bill" : undefined}
      bill={bill}
      shopName={single ? undefined : group.shopName}
      action={
        single ? null : (
          <Button size="lg" block loading={placing} disabled={bill.short > 0} onClick={place}>
            <span className="num">{t("placeOrder", { total: formatRs(bill.total) })}</span>
          </Button>
        )
      }
    />
  );
}

/**
 * The always-visible bar for a one-dukan cart: the total (tap to see the bill) and one clear
 * next step. Without an address it asks for one; below the minimum it says how much to add.
 */
function PlaceBar({
  group,
  shop,
  address,
}: {
  group: CartGroup;
  shop: NearbyShop | undefined;
  address: SavedAddress | null;
}) {
  const t = useTranslations("storefront.cart");
  const bill = billFor(group, shop);
  const reach = reachOf(shop, address);
  const blocked = reach === "out" || reach === "closed";
  const { place, placing } = usePlaceOrder(group, address, bill.total);
  return (
    <StickyActionBar className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => reveal("cart-bill")}
        className="flex min-h-12 shrink-0 flex-col items-start justify-center rounded-xl px-3 text-start"
      >
        <span className="num font-heading text-lg leading-6 font-bold text-ink">
          {formatRs(bill.total)}
        </span>
        <span className="text-xs font-semibold text-primary-strong underline decoration-dotted underline-offset-2">
          {t("viewBill")}
        </span>
      </button>
      {address ? (
        <Button
          size="lg"
          className="min-w-0 flex-1"
          loading={placing}
          disabled={bill.short > 0 || blocked}
          onClick={place}
        >
          <span className="num truncate">
            {bill.short > 0
              ? t("addMoreToOrder", { amount: formatRs(bill.short) })
              : t("placeOrderShort")}
          </span>
          {bill.short > 0 ? null : <ChevronRight aria-hidden className="rtl:-scale-x-100" />}
        </Button>
      ) : (
        <Button size="lg" className="min-w-0 flex-1" onClick={() => reveal("cart-address")}>
          <MapPin aria-hidden />
          <span className="truncate">{t("chooseAddress")}</span>
        </Button>
      )}
    </StickyActionBar>
  );
}

/** One dukan's items with steppers, its free-delivery progress and its minimum order. */
function ShopItemsCard({
  group,
  shop,
  address,
}: {
  group: CartGroup;
  shop: NearbyShop | undefined;
  address: SavedAddress | null;
}) {
  const t = useTranslations("storefront.cart");
  const tShop = useTranslations("storefront");
  const setQuantity = useCustomerCart((state) => state.setQuantity);
  const clearShop = useCustomerCart((state) => state.clearShop);
  const bill = billFor(group, shop);
  const reach = reachOf(shop, address);
  const blocked = reach === "out" || reach === "closed";

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
              {line.packSize ? <p className="text-xs text-muted">{line.packSize}</p> : null}
              <p className="num flex items-baseline gap-1.5 text-sm">
                <span className="font-semibold text-ink">
                  {formatRs(line.pricePaisa * line.quantity)}
                </span>
                {line.mrpPaisa && line.mrpPaisa > line.pricePaisa ? (
                  <span className="text-xs text-muted line-through">
                    {formatRs(line.mrpPaisa * line.quantity)}
                  </span>
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
      ) : bill.short > 0 || (bill.freeAbove !== null && bill.usualFee > 0) ? (
        <div className="flex flex-col gap-2 border-t border-border/70 px-4 py-3.5">
          {bill.short > 0 ? (
            <p className="num rounded-md bg-awning-soft px-3 py-2 text-sm font-semibold text-awning-ink">
              {t("belowMin", { amount: formatRs(bill.minOrder), short: formatRs(bill.short) })}
            </p>
          ) : bill.freeAbove !== null && bill.fee > 0 ? (
            <>
              <p
                id={`free-${group.shopId}`}
                className="num text-sm font-semibold text-primary-strong"
              >
                {t("addMoreForFree", { amount: formatRs(bill.freeAbove - bill.itemTotal) })}
              </p>
              <Progress
                aria-labelledby={`free-${group.shopId}`}
                value={Math.min((bill.itemTotal / bill.freeAbove) * 100, 100)}
              />
            </>
          ) : (
            <p className="text-sm font-semibold text-primary-strong">{t("freeUnlocked")}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
