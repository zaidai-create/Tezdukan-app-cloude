import { describe, expect, it } from "vitest";
import { shortName } from "./short-name";

describe("shortName", () => {
  it("keeps the brand and drops the pack size", () => {
    expect(shortName("Coca-Cola 1.5 L")).toBe("Coca-Cola");
    expect(shortName("7Up 1.5 L")).toBe("7Up");
    expect(shortName("Dalda Cooking Oil Pouch")).toBe("Dalda");
  });

  it("adds the next word to a very short brand", () => {
    expect(shortName("LU Prince Chocolate Biscuit Half Roll")).toBe("LU Prince");
  });

  it("ignores brackets and commas", () => {
    expect(shortName("Cheeni (Sugar), loose")).toBe("Cheeni");
  });
});
