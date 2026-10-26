import { describe, expect, it } from "vitest";
import { businessDay, formatDate, formatDateTime, formatNumber, formatTime } from "./format";

// 2026-10-25T19:30:00Z is 26 Oct 2026, 00:30 in Karachi (UTC+5).
const lateNightUtc = "2026-10-25T19:30:00Z";

describe("dates in Asia/Karachi", () => {
  it("uses DD/MM/YYYY", () => {
    expect(formatDate("2026-03-07T06:00:00Z")).toBe("07/03/2026");
  });

  it("rolls the business day over at Karachi midnight, not UTC midnight", () => {
    expect(formatDate(lateNightUtc)).toBe("26/10/2026");
    expect(businessDay(lateNightUtc)).toBe("2026-10-26");
  });

  it("formats times in 12-hour clock", () => {
    expect(formatTime("2026-10-25T10:45:00Z")).toBe("3:45 pm");
    expect(formatDateTime("2026-10-25T10:45:00Z")).toBe("25/10/2026, 3:45 pm");
  });
});

describe("numbers", () => {
  it("groups thousands and keeps up to three decimals", () => {
    expect(formatNumber(1250)).toBe("1,250");
    expect(formatNumber(2.5)).toBe("2.5");
    expect(formatNumber(0.125)).toBe("0.125");
  });
});
