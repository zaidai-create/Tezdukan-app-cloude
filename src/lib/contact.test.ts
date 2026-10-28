import { describe, expect, it } from "vitest";
import { mapsHref, telHref, whatsappHref } from "./contact";

describe("contact links", () => {
  it("calls an E.164 number", () => {
    expect(telHref("+923001234567")).toBe("tel:+923001234567");
    expect(telHref("0300 1234567")).toBeNull();
    expect(telHref(null)).toBeNull();
  });

  it("opens WhatsApp without the plus, with an encoded message", () => {
    expect(whatsappHref("+923001234567")).toBe("https://wa.me/923001234567");
    expect(whatsappHref("+923001234567", "Order TD-000123 kab tak?")).toBe(
      "https://wa.me/923001234567?text=Order%20TD-000123%20kab%20tak%3F",
    );
    expect(whatsappHref("abc")).toBeNull();
  });

  it("maps a pin only when it is a real coordinate", () => {
    expect(mapsHref(25.39, 68.36)).toBe(
      "https://www.google.com/maps/search/?api=1&query=25.39,68.36",
    );
    expect(mapsHref(null, 68.36)).toBeNull();
    expect(mapsHref(125, 68)).toBeNull();
  });
});
