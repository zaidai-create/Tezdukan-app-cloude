import { describe, expect, it } from "vitest";
import { addressInputSchema, addressText, labelKey, metresBetween } from "./schemas";

describe("addresses", () => {
  it("writes the house first, then the street and the landmark", () => {
    expect(
      addressText({ line1: "Street 4, Heerabad", line2: "House 9", landmark: "Near the masjid" }),
    ).toBe("House 9, Street 4, Heerabad, Near the masjid");
    expect(addressText({ line1: "Street 4, Heerabad", line2: " ", landmark: null })).toBe(
      "Street 4, Heerabad",
    );
  });

  it("treats an unknown label as Other", () => {
    expect(labelKey("Work")).toBe("Work");
    expect(labelKey("Ammi ka ghar")).toBe("Other");
  });

  it("measures the distance between two pins", () => {
    const saddar = { lat: 25.396, lng: 68.3578 };
    expect(metresBetween(saddar, saddar)).toBe(0);
    // About 0.01 degrees of latitude is 1.1 km.
    expect(Math.round(metresBetween(saddar, { lat: 25.406, lng: 68.3578 }) / 10)).toBe(111);
  });

  it("needs a pin in Pakistan and a few words of address", () => {
    const good = { label: "Home", line1: "Street 4, Heerabad", lat: 25.39, lng: 68.37 } as const;
    expect(addressInputSchema.safeParse(good).success).toBe(true);
    expect(addressInputSchema.safeParse({ ...good, line1: "H 9" }).success).toBe(false);
    expect(addressInputSchema.safeParse({ ...good, lat: 51.5, lng: -0.12 }).success).toBe(false);
    expect(addressInputSchema.safeParse({ ...good, lat: undefined }).success).toBe(false);
  });
});
