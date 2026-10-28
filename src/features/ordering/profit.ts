import type { CartLine } from "./schemas";

/**
 * Profit maths for the dukandar (all integer paisa). Free scheme pieces cost nothing and sell
 * like the rest, which is why a scheme raises the real margin.
 */
export type ProfitPlan = {
  /** What the dukandar pays the distributor. */
  cost: number;
  /** What they get back selling every piece (paid and free) at the chosen price. */
  revenue: number;
  profit: number;
  /** Profit per piece sold, rounded to the paisa. */
  perPiece: number;
  /** Profit as a share of the selling price, one decimal. */
  marginPercent: number;
};

export function profitPlan({
  costPaisa,
  sellPaisa,
  pieces,
  freePieces = 0,
}: {
  costPaisa: number;
  sellPaisa: number;
  pieces: number;
  freePieces?: number;
}): ProfitPlan {
  const sold = Math.max(0, pieces) + Math.max(0, freePieces);
  const cost = costPaisa * Math.max(0, pieces);
  const revenue = sellPaisa * sold;
  const profit = revenue - cost;
  return {
    cost,
    revenue,
    profit,
    perPiece: sold > 0 ? Math.round(profit / sold) : 0,
    marginPercent: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
  };
}

/** Free pieces a buy-X-get-Y scheme gives for a quantity (other schemes give none). */
export function schemeFreePieces(rules: Record<string, unknown> | null, pieces: number): number {
  if (!rules) return 0;
  const buy = Number(rules.buy_base_qty);
  const free = Number(rules.free_base_qty);
  if (!Number.isFinite(buy) || !Number.isFinite(free) || buy <= 0 || free <= 0) return 0;
  return Math.floor(pieces / buy) * free;
}

/** What the cart earns if everything (free goods included) sells at MRP. */
export function cartProfit(
  lines: Pick<
    CartLine,
    "item" | "quantity" | "base_qty_per_unit" | "free_base_qty" | "line_total_paisa"
  >[],
) {
  let cost = 0;
  let revenue = 0;
  for (const line of lines) {
    const mrp = line.item?.mrp_paisa ?? 0;
    if (mrp <= 0) continue;
    cost += line.line_total_paisa;
    revenue += mrp * (line.quantity * line.base_qty_per_unit + line.free_base_qty);
  }
  return { cost, revenue, profit: revenue - cost };
}
