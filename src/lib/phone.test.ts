import { describe, expect, it } from "vitest";
import {
  formatPkMobileInput,
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

describe("formatPkMobileInput", () => {
  it.each([
    ["03001234567", "0300 1234567"],
    ["3001234567", "300 1234567"],
    ["0300-123-4567", "0300 1234567"],
    ["+92 300 1234567", "300 1234567"],
    ["923001234567", "300 1234567"],
    ["00923001234567", "300 1234567"],
    ["+92 0300 1234567", "0300 1234567"],
    ["030012345678", "0300 1234567"],
    ["", ""],
  ])("formats %s as %s", (raw, expected) => {
    expect(formatPkMobileInput(raw).value).toBe(expected);
  });

  it("formats while typing, one digit at a time", () => {
    const typed = ["0", "03", "030", "0300", "03001"].map((raw) => formatPkMobileInput(raw).value);
    expect(typed).toEqual(["0", "03", "030", "0300", "0300 1"]);
  });

  it("keeps the cursor after the digit just typed", () => {
    expect(formatPkMobileInput("03001")).toEqual({ value: "0300 1", caret: 6 });
    // "9" typed after "0300" in "0300 1234567": the number is capped at 11 digits.
    expect(formatPkMobileInput("03009 1234567", 5)).toEqual({ value: "0300 9123456", caret: 6 });
    // Cursor at the very start stays there.
    expect(formatPkMobileInput("3001234567", 0).caret).toBe(0);
  });

  it("produces numbers the validator accepts", () => {
    expect(isPkMobile(formatPkMobileInput("+923001234567").value)).toBe(true);
    expect(isPkMobile(formatPkMobileInput("03001234567").value)).toBe(true);
  });
});
