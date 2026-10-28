import { describe, expect, it } from "vitest";
import { cartProfit, profitPlan, schemeFreePieces } from "./profit";

describe("profitPlan", () => {
  it("adds up cost, revenue and margin in paisa", () => {
    // Buy 12 at Rs 1,000, sell at Rs 1,200.
    expect(profitPlan({ costPaisa: 100_000, sellPaisa: 120_000, pieces: 12 })).toEqual({
      cost: 1_200_000,
      revenue: 1_440_000,
      profit: 240_000,
      perPiece: 20_000,
      marginPercent: 16.7,
    });
  });

  it("counts free scheme pieces as stock that sells", () => {
    const plan = profitPlan({ costPaisa: 100_000, sellPaisa: 120_000, pieces: 12, freePieces: 1 });
    expect(plan.revenue).toBe(1_560_000);
    expect(plan.profit).toBe(360_000);
  });

  it("shows a loss when the selling price is below cost", () => {
    expect(profitPlan({ costPaisa: 50_000, sellPaisa: 45_000, pieces: 2 }).profit).toBe(-10_000);
  });

  it("never divides by zero", () => {
    expect(profitPlan({ costPaisa: 100, sellPaisa: 0, pieces: 0 })).toMatchObject({
      perPiece: 0,
      marginPercent: 0,
    });
  });
});

describe("schemeFreePieces", () => {
  it("gives the free pieces of a buy-X-get-Y scheme", () => {
    expect(schemeFreePieces({ buy_base_qty: 12, free_base_qty: 1 }, 25)).toBe(2);
  });

  it("gives nothing for other schemes or bad rules", () => {
    expect(schemeFreePieces({ slabs: [] }, 25)).toBe(0);
    expect(schemeFreePieces(null, 25)).toBe(0);
  });
});

describe("cartProfit", () => {
  it("values paid and free pieces at MRP against what the lines cost", () => {
    const line = (mrp: number, quantity: number, perUnit: number, free: number, total: number) => ({
      item: { mrp_paisa: mrp } as never,
      quantity,
      base_qty_per_unit: perUnit,
      free_base_qty: free,
      line_total_paisa: total,
    });
    expect(cartProfit([line(120, 2, 12, 1, 2_000), line(0, 1, 1, 0, 500)])).toEqual({
      cost: 2_000,
      revenue: 3_000,
      profit: 1_000,
    });
  });
});
