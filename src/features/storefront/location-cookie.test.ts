import { describe, expect, it } from "vitest";
import { formatLocation, parseLocation } from "./location-cookie";

describe("delivery location cookie", () => {
  it("reads a point in Pakistan", () => {
    expect(parseLocation("25.39600,68.35780")).toEqual({ lat: 25.396, lng: 68.3578 });
    expect(parseLocation(encodeURIComponent(formatLocation(25.4, 68.37)))).toEqual({
      lat: 25.4,
      lng: 68.37,
    });
  });

  it("ignores anything else", () => {
    expect(parseLocation(undefined)).toBeNull();
    expect(parseLocation("51.5,-0.12")).toBeNull();
    expect(parseLocation("abc")).toBeNull();
  });
});
