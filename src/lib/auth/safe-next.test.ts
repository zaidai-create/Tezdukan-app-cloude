import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("keeps same-site paths with their query", () => {
    expect(safeNextPath("/dukan/orders?status=new")).toBe("/dukan/orders?status=new");
    expect(safeNextPath("/")).toBe("/");
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "https://evil.com/x",
    "javascript:alert(1)",
    "evil.com",
    "",
    null,
    undefined,
    42,
  ])("rejects %s", (value) => {
    expect(safeNextPath(value)).toBe("/");
  });

  it("uses the fallback", () => {
    expect(safeNextPath("//x", "/dukan")).toBe("/dukan");
  });
});
