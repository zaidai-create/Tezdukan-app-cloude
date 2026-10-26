import { describe, expect, it } from "vitest";
import {
  discountPercent,
  formatRs,
  lineTotal,
  marginPercent,
  parseRupees,
  rupeesToPaisa,
  sumPaisa,
} from "./money";

describe("formatRs", () => {
  it("formats whole rupees without decimals", () => {
    expect(formatRs(125000)).toBe("Rs 1,250");
    expect(formatRs(0)).toBe("Rs 0");
    expect(formatRs(1_250_000_00)).toBe("Rs 1,250,000");
  });

  it("shows paisa only when present", () => {
    expect(formatRs(125050)).toBe("Rs 1,250.50");
    expect(formatRs(5)).toBe("Rs 0.05");
  });

  it("signs ledger amounts", () => {
    expect(formatRs(-75000)).toBe("−Rs 750");
    expect(formatRs(75000, { signed: true })).toBe("+Rs 750");
    expect(formatRs(0, { signed: true })).toBe("Rs 0");
  });
});

describe("parseRupees", () => {
  it("accepts the ways people type amounts", () => {
    expect(parseRupees("1,250")).toBe(125000);
    expect(parseRupees("1250.5")).toBe(125050);
    expect(parseRupees("Rs 99")).toBe(9900);
    expect(parseRupees("rs.12.05")).toBe(1205);
    expect(parseRupees(" 0 ")).toBe(0);
  });

  it("rejects anything ambiguous", () => {
    expect(parseRupees("")).toBeNull();
    expect(parseRupees("-5")).toBeNull();
    expect(parseRupees("1.234")).toBeNull();
    expect(parseRupees("12abc")).toBeNull();
    expect(parseRupees("1e5")).toBeNull();
  });
});

describe("arithmetic", () => {
  it("keeps paisa as integers", () => {
    expect(rupeesToPaisa(19.99)).toBe(1999);
    expect(lineTotal(28000, 3)).toBe(84000);
    expect(lineTotal(32000, 0.25)).toBe(8000);
    expect(lineTotal(33333, 1.5)).toBe(50000);
    expect(sumPaisa([100, 250, 1])).toBe(351);
  });

  it("computes margin and discount", () => {
    expect(marginPercent(21500, 25000)).toBe(14);
    expect(marginPercent(100, 0)).toBe(0);
    expect(discountPercent(27500, 31000)).toBe(11);
    expect(discountPercent(31000, 31000)).toBe(0);
  });
});
