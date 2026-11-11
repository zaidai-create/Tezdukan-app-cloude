import { describe, expect, it } from "vitest";
import {
  ADDRESS_COOKIE,
  deliveryPointCookies,
  formatLocation,
  LOCATION_COOKIE,
  LOCATION_LABEL_COOKIE,
  parseLocation,
} from "./location-cookie";

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

  it("remembers a saved address with its point and its id", () => {
    const [point, label, address] = deliveryPointCookies({
      lat: 25.3941,
      lng: 68.3713,
      label: "Street 4, Heerabad",
      addressId: "079bc1fd-414a-482a-a543-52628c6a86ff",
    });
    expect(point).toContain(`${LOCATION_COOKIE}=${encodeURIComponent("25.39410,68.37130")}`);
    expect(label).toContain(`${LOCATION_LABEL_COOKIE}=${encodeURIComponent("Street 4, Heerabad")}`);
    expect(address).toContain(`${ADDRESS_COOKIE}=079bc1fd-414a-482a-a543-52628c6a86ff`);
    expect(address).toContain("max-age=31536000");
  });

  it("forgets the saved address when the point is only GPS or an area", () => {
    const cookies = deliveryPointCookies({ lat: 25.38, lng: 68.37, label: "Latifabad Unit 6" });
    expect(cookies[2]).toBe(`${ADDRESS_COOKIE}=; path=/; max-age=0; samesite=lax`);
  });

  it("keeps a long label short enough for a cookie", () => {
    const [, label] = deliveryPointCookies({ lat: 25.38, lng: 68.37, label: "x".repeat(300) });
    expect(label?.split(";")[0]?.length).toBeLessThanOrEqual(LOCATION_LABEL_COOKIE.length + 81);
  });
});
