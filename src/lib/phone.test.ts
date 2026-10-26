import { describe, expect, it } from "vitest";
import {
  formatPkMobile,
  isPkMobile,
  maskPkMobile,
  normalizePkMobile,
  whatsappNumber,
} from "./phone";

describe("normalizePkMobile", () => {
  it.each([
    "03001234567",
    "0300-1234567",
    "0300 1234567",
    "3001234567",
    "923001234567",
    "+923001234567",
    "+92 300 1234567",
    "+92 (300) 123-4567",
    "00923001234567",
  ])("normalises %s", (input) => {
    expect(normalizePkMobile(input)).toBe("+923001234567");
  });

  it.each(["", "12345", "0221234567", "+14155552671", "0300123456", "030012345678", "abc"])(
    "rejects %s",
    (input) => {
      expect(normalizePkMobile(input)).toBeNull();
      expect(isPkMobile(input)).toBe(false);
    },
  );
});

describe("display helpers", () => {
  it("formats, masks and builds WhatsApp numbers", () => {
    expect(formatPkMobile("+923001234567")).toBe("0300 1234567");
    expect(maskPkMobile("+923001234567")).toBe("0300 ••• 4567");
    expect(whatsappNumber("+923001234567")).toBe("923001234567");
  });
});
