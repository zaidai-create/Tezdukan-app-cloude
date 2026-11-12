import { describe, expect, it } from "vitest";
import type { CartLine } from "../../cart-store";
import type { NearbyShop } from "../../schemas";
import { billFor, changeNotesFor, groupByShop } from "./bill";

const line = (overrides: Partial<CartLine>): CartLine => ({
  id: crypto.randomUUID(),
  shopId: "00000000-0000-4000-8000-000000000001",
  shopName: "Kiryana",
  shopSlug: "kiryana",
  name: "Chai",
  packSize: null,
  pricePaisa: 10000,
  mrpPaisa: null,
  imagePath: null,
  quantity: 1,
  ...overrides,
});

const shop = (overrides: Partial<NearbyShop>) =>
  ({
    delivery_fee_paisa: 5000,
    free_delivery_above_paisa: 100000,
    min_order_paisa: 30000,
    ...overrides,
  }) as NearbyShop;

describe("billFor", () => {
  it("adds the delivery fee below the free-delivery line and counts MRP savings", () => {
    const [group] = groupByShop([line({ pricePaisa: 17000, mrpPaisa: 18000, quantity: 2 })]);
    if (!group) throw new Error("no group");
    const bill = billFor(group, shop({}));
    expect(bill).toMatchObject({
      itemTotal: 34000,
      mrpTotal: 36000,
      fee: 5000,
      usualFee: 5000,
      savings: 2000,
      short: 0,
      total: 39000,
    });
  });

  it("waives delivery above the line and counts the waived fee as saved", () => {
    const [group] = groupByShop([line({ pricePaisa: 60000, quantity: 2 })]);
    if (!group) throw new Error("no group");
    const bill = billFor(group, shop({}));
    expect(bill.fee).toBe(0);
    expect(bill.savings).toBe(5000);
    expect(bill.total).toBe(120000);
  });

  it("says how much is missing to reach the minimum", () => {
    const [group] = groupByShop([line({ pricePaisa: 20000 })]);
    if (!group) throw new Error("no group");
    expect(billFor(group, shop({})).short).toBe(10000);
  });
});

describe("changeNotesFor", () => {
  it("offers only notes larger than the bill", () => {
    expect(changeNotesFor(44000)).toEqual([500, 1000, 5000]);
    expect(changeNotesFor(50000)).toEqual([1000, 5000]);
    expect(changeNotesFor(120000)).toEqual([5000]);
    expect(changeNotesFor(600000)).toEqual([]);
  });
});
