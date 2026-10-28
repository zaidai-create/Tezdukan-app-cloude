import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import { defaultUnit, deliveryDay, ltr, margin, schemeLabel, slotWindow, unitName } from "./labels";
import type { CatalogItem, PackUnit, Scheme } from "./schemas";

const t = createTranslator({ locale: "en", messages: en, namespace: "ordering" });

const scheme = (kind: Scheme["kind"], rules: Scheme["rules"]): Scheme => ({
  id: "6f1c1c0e-1d7a-4a7b-9b1a-2a3c4d5e6f70",
  kind,
  name: "Test",
  name_ur: null,
  rules,
  ends_at: null,
});

describe("scheme labels", () => {
  it("reads buy-x-get-y as pieces", () => {
    expect(schemeLabel(t, scheme("buy_x_get_y", { buy_base_qty: 12, free_base_qty: 1 }))).toBe(
      "12 + 1 free",
    );
  });
  it("shows the best slab", () => {
    const rules = {
      basis: "quantity",
      slabs: [
        { min: 24, discount_bps: 200 },
        { min: 48, discount_bps: 300 },
      ],
    };
    expect(schemeLabel(t, scheme("slab_discount", rules))).toBe("Up to 3% off");
  });
  it("shows flat discounts as a percent or rupees per piece", () => {
    expect(schemeLabel(t, scheme("flat_discount", { discount_bps: 500 }))).toBe("5% off");
    expect(schemeLabel(t, scheme("flat_discount", { discount_paisa_per_unit: 200 }))).toBe(
      "Rs 2 off per pc",
    );
  });
});

describe("units and margin", () => {
  const carton: PackUnit = {
    id: "c",
    unit: "carton",
    label: "Carton (12 pcs)",
    base_qty: 12,
    is_default: true,
  };
  const piece: PackUnit = {
    id: "p",
    unit: "piece",
    label: "Piece",
    base_qty: 1,
    is_default: false,
  };

  it("names packs with their piece count", () => {
    expect(unitName(t, carton)).toBe("Carton (12)");
    expect(unitName(t, piece)).toBe("Piece");
  });
  it("starts on the distributor's default pack", () => {
    expect(
      defaultUnit({ pack_units: [piece, carton] } as Pick<CatalogItem, "pack_units"> as CatalogItem)
        ?.id,
    ).toBe("c");
  });
  it("measures profit at MRP per piece", () => {
    expect(margin({ mrp_paisa: 24_600, price_paisa: 21_800 })).toEqual({
      perPiece: 2_800,
      percent: 11.4,
    });
    expect(margin({ mrp_paisa: 0, price_paisa: 100 }).percent).toBe(0);
  });
});

describe("delivery days", () => {
  // 28 Oct 2026, 10:00 in Karachi.
  const now = new Date("2026-10-28T05:00:00Z");

  it("says tomorrow and the day after, then the date", () => {
    expect(deliveryDay(t, "2026-10-29T05:00:00Z", now)).toBe("tomorrow");
    expect(deliveryDay(t, "2026-10-30T05:00:00Z", now)).toBe("day after tomorrow");
    expect(deliveryDay(t, "2026-11-02T05:00:00Z", now)).toBe(ltr("02/11/2026"));
  });
  it("keeps times left to right inside Urdu text", () => {
    expect(slotWindow(t, "2026-10-29T05:00:00Z", "2026-10-29T07:00:00Z")).toBe(
      `${ltr("10:00 am")} to ${ltr("12:00 pm")}`,
    );
  });
});
