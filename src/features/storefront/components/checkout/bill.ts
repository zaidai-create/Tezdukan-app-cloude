import type { SavedAddress } from "@/features/addresses/schemas";
import type { CartLine } from "../../cart-store";
import type { NearbyShop } from "../../schemas";

/** One dukan's part of the cart: it becomes one order. */
export type CartGroup = { shopId: string; shopName: string; shopSlug: string; lines: CartLine[] };

export function groupByShop(lines: readonly CartLine[]): CartGroup[] {
  const groups = new Map<string, CartGroup>();
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

export type Bill = {
  /** What the items cost at the dukan's prices. */
  itemTotal: number;
  /** What they would cost at printed prices (MRP), when higher. */
  mrpTotal: number;
  /** MRP savings on the items. */
  savings: number;
  /** The dukan's usual delivery fee, shown struck through when it is waived. */
  usualFee: number;
  freeAbove: number | null;
  fee: number;
  minOrder: number;
  /** How much more is needed to reach the minimum order. */
  short: number;
  total: number;
};

/** One dukan's bill: items, delivery (free above its threshold), savings and the minimum. */
export function billFor(group: CartGroup, shop: NearbyShop | undefined): Bill {
  const itemTotal = group.lines.reduce((sum, line) => sum + line.pricePaisa * line.quantity, 0);
  const mrpTotal = group.lines.reduce(
    (sum, line) => sum + Math.max(line.mrpPaisa ?? 0, line.pricePaisa) * line.quantity,
    0,
  );
  const freeAbove = shop?.free_delivery_above_paisa ?? null;
  const usualFee = shop?.delivery_fee_paisa ?? 0;
  const fee = freeAbove !== null && itemTotal >= freeAbove ? 0 : usualFee;
  const minOrder = shop?.min_order_paisa ?? 0;
  return {
    itemTotal,
    mrpTotal,
    savings: mrpTotal - itemTotal + (usualFee - fee),
    usualFee,
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
export type Reach = "ok" | "out" | "closed" | "unknown";
export function reachOf(shop: NearbyShop | undefined, address: SavedAddress | null): Reach {
  if (!address) return "unknown";
  if (!shop) return "out";
  return shop.is_live ? "ok" : "closed";
}

/** Notes worth offering for change on a bill: only those larger than it, at most three. */
export function changeNotesFor(totalPaisa: number): number[] {
  return [500, 1000, 5000].filter((rupees) => rupees * 100 > totalPaisa).slice(0, 3);
}
