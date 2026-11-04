import { describe, expect, it } from "vitest";
import { hourLabel, marginOf, peakIndex, percentChange, slotLabel } from "./figures";

describe("sales report figures", () => {
  it("works out the change from the previous period", () => {
    expect(percentChange(118, 100)).toBe(18);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(100, 0)).toBeNull();
  });

  it("works out margin only from costed sales", () => {
    expect(marginOf(20_000, 100_000)).toBe(20);
    expect(marginOf(5_000, 0)).toBeNull();
  });

  it("finds the busiest slot and none when nothing sold", () => {
    expect(peakIndex([0, 300, 900, 200])).toBe(2);
    expect(peakIndex([0, 0, 0])).toBe(-1);
  });

  it("labels hours and 3-hour slots", () => {
    expect(hourLabel(0)).toBe("12 am");
    expect(hourLabel(12)).toBe("12 pm");
    expect(hourLabel(18)).toBe("6 pm");
    expect(slotLabel(21)).toBe("9 pm – 12 am");
  });
});
