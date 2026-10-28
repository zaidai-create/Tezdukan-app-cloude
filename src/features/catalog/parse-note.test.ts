import { describe, expect, it } from "vitest";
import { hasDetails, parseProductNote } from "./parse-note";

const brands = ["Tapal", "Shan", "Dalda", "Olpers"];

describe("parseProductNote", () => {
  it("reads the common English shorthand", () => {
    expect(parseProductNote("Tapal Danedar 950g, carton 12, rate 1750, MRP 1950", brands)).toEqual({
      name: "Tapal Danedar 950 g",
      name_ur: null,
      brand: "Tapal",
      category: null,
      pack_size_label: "950 g",
      trade_price_rupees: 1750,
      mrp_rupees: 1950,
      carton_qty: 12,
      moq_pieces: null,
      barcode: null,
    });
  });

  it("reads Roman Urdu phrasing", () => {
    const draft = parseProductNote("shan biryani masala 50 gm 12 wala dabba tp 95 mrp 120", brands);
    expect(draft).toMatchObject({
      name: "Shan Biryani Masala 50 g",
      brand: "Shan",
      pack_size_label: "50 g",
      trade_price_rupees: 95,
      mrp_rupees: 120,
      carton_qty: 12,
    });
  });

  it("normalises litres and reads prices with commas, MOQ and barcode", () => {
    const draft = parseProductNote(
      "Dalda cooking oil 1 litre rate Rs 1,640 MRP: 1,750 moq 6 8964000123456",
      brands,
    );
    expect(draft).toMatchObject({
      pack_size_label: "1 L",
      trade_price_rupees: 1640,
      mrp_rupees: 1750,
      moq_pieces: 6,
      barcode: "8964000123456",
      brand: "Dalda",
    });
  });

  it("finds nothing in an empty note", () => {
    expect(hasDetails(parseProductNote("   ", brands))).toBe(false);
  });
});
