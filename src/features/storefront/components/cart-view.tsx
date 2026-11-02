"use client";

import { ShoppingBasket, Wallet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { AddToCart } from "@/components/commerce/add-to-cart";
import { ProductImage } from "@/components/commerce/product-image";
import { EmptyState } from "@/components/states/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { storageUrl } from "@/features/ordering/images";
import { placeCustomerOrder } from "@/features/customer-orders/actions";
import { Link, useRouter } from "@/i18n/navigation";
import { haptic } from "@/lib/haptics";
import { formatRs } from "@/lib/money";
import { useCustomerCart, type CartLine } from "../cart-store";
import type { NearbyShop } from "../schemas";

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

/** The shopper's cart: one card per dukan with its bill, ordered straight to the dukan. */
export function CartView({ shops }: { shops: NearbyShop[] }) {
  const t = useTranslations("storefront.cart");
  const locale = useLocale();
  const lines = useCustomerCart((state) => state.lines);
  const address = useCustomerCart((state) => state.address);
  const setAddress = useCustomerCart((state) => state.setAddress);
  const groups = groupByShop(lines);

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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-5">
      <h1 className="font-heading text-2xl font-bold text-ink lg:text-3xl">{t("title")}</h1>

      <section className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
        <Label htmlFor="cart-address">{t("address")}</Label>
        <Input
          id="cart-address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder={t("addressPlaceholder")}
          autoComplete="street-address"
          maxLength={300}
        />
      </section>

      {groups.map((group) => (
        <ShopCartCard
          key={group.shopId}
          group={group}
          shop={shops.find((shop) => shop.id === group.shopId)}
          address={address}
          locale={locale}
        />
      ))}
    </div>
  );
}

function ShopCartCard({
  group,
  shop,
  address,
  locale,
}: {
  group: Group;
  shop: NearbyShop | undefined;
  address: string;
  locale: string;
}) {
  const t = useTranslations("storefront.cart");
  const tShop = useTranslations("storefront");
  const tOrders = useTranslations("customerOrders");
  const router = useRouter();
  const setQuantity = useCustomerCart((state) => state.setQuantity);
  const clearShop = useCustomerCart((state) => state.clearShop);
  const [placing, startPlacing] = useTransition();
  // One id per attempt, so a retried tap never places the order twice.
  const requestId = useRef<string>(crypto.randomUUID());

  const itemTotal = group.lines.reduce((sum, line) => sum + line.pricePaisa * line.quantity, 0);
  const savings = group.lines.reduce(
    (sum, line) =>
      sum + Math.max((line.mrpPaisa ?? line.pricePaisa) - line.pricePaisa, 0) * line.quantity,
    0,
  );
  const freeAbove = shop?.free_delivery_above_paisa ?? null;
  const fee = freeAbove !== null && itemTotal >= freeAbove ? 0 : (shop?.delivery_fee_paisa ?? 0);
  const minOrder = shop?.min_order_paisa ?? 0;
  const short = Math.max(minOrder - itemTotal, 0);
  const total = itemTotal + fee;

  const place = () => {
    if (address.trim().length < 5) {
      toast.error(t("addressNeeded"));
      document.getElementById("cart-address")?.focus();
      return;
    }
    startPlacing(async () => {
      const result = await placeCustomerOrder({
        shopId: group.shopId,
        items: group.lines.map((line) => ({ inventoryId: line.id, qty: line.quantity })),
        address: address.trim(),
        requestId: requestId.current,
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

  return (
    <section className="overflow-hidden rounded-lg border border-border/60 bg-surface shadow-card">
      <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <Link href={`/shops/${group.shopSlug}`} className="min-w-0">
          <span className="block truncate font-heading text-lg font-semibold text-ink">
            {group.shopName}
          </span>
          {shop?.eta_minutes ? (
            <span className="num block text-sm text-muted">
              {tShop("eta", { minutes: shop.eta_minutes })}
            </span>
          ) : null}
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
              <p className="num text-sm text-muted">{formatRs(line.pricePaisa)}</p>
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

      <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-4">
        {freeAbove !== null && fee > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="num text-sm font-semibold text-primary-strong">
              {t("addMoreForFree", { amount: formatRs(freeAbove - itemTotal) })}
            </p>
            <Progress value={Math.min((itemTotal / freeAbove) * 100, 100)} />
          </div>
        ) : freeAbove !== null ? (
          <p className="text-sm font-semibold text-primary-strong">{t("freeUnlocked")}</p>
        ) : null}

        <dl
          className="num flex flex-col gap-1.5 text-base"
          dir={locale === "ur" ? "rtl" : undefined}
        >
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{t("itemTotal")}</dt>
            <dd className="text-ink">{formatRs(itemTotal)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{t("delivery")}</dt>
            <dd className="text-ink">{fee === 0 ? t("free") : formatRs(fee)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-border/70 pt-2 font-heading text-lg font-bold">
            <dt className="text-ink">{t("toPay")}</dt>
            <dd className="text-ink">{formatRs(total)}</dd>
          </div>
          {savings > 0 ? (
            <p className="text-sm font-semibold text-primary-strong">
              {t("savings", { amount: formatRs(savings) })}
            </p>
          ) : null}
        </dl>

        {short > 0 ? (
          <p className="rounded-md bg-awning-soft px-3 py-2 text-sm font-semibold text-awning-ink">
            {t("belowMin", { amount: formatRs(minOrder), short: formatRs(short) })}
          </p>
        ) : null}

        <p className="flex items-center gap-2 text-sm font-medium text-ink">
          <Wallet aria-hidden className="size-4 text-primary" />
          {tOrders("cod")}
        </p>
        <Button size="lg" block loading={placing} disabled={short > 0} onClick={place}>
          <span className="num">{t("placeOrder", { total: formatRs(total) })}</span>
        </Button>
      </div>
    </section>
  );
}
