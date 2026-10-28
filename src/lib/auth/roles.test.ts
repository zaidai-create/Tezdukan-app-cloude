import { describe, expect, it } from "vitest";
import { isAuthPath, isPublicPath, parseContext, roleForPath, serializeContext } from "./roles";

describe("roleForPath", () => {
  it("maps role prefixes", () => {
    expect(roleForPath("/dukan")).toBe("dukandar");
    expect(roleForPath("/dukan/manage/pos")).toBe("dukandar");
    expect(roleForPath("/distributor/orders/123")).toBe("distributor");
    expect(roleForPath("/booker")).toBe("booker");
    expect(roleForPath("/rider/trips/1")).toBe("rider");
    expect(roleForPath("/admin/flags")).toBe("admin");
  });

  it("does not match look-alike paths", () => {
    expect(roleForPath("/dukandar")).toBeNull();
    expect(roleForPath("/")).toBeNull();
    expect(roleForPath("/orders")).toBeNull();
  });
});

describe("public and auth paths", () => {
  it("knows which pages need no session", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/welcome")).toBe(true);
    expect(isPublicPath("/s/tezdukan")).toBe(true);
    expect(isPublicPath("/dev/design-system")).toBe(true);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/dukan")).toBe(false);
    expect(isPublicPath("/login-help")).toBe(false);
  });

  it("knows auth screens", () => {
    expect(isAuthPath("/signup")).toBe(true);
    expect(isAuthPath("/welcome")).toBe(true);
    expect(isAuthPath("/forgot-password")).toBe(false);
  });
});

describe("context cookie", () => {
  const id = "0b9f6b1e-2a2f-4f0e-9d7a-2f3c4b5a6d7e";

  it("round-trips", () => {
    expect(parseContext(serializeContext({ role: "dukandar", contextId: id }))).toEqual({
      role: "dukandar",
      contextId: id,
    });
    expect(parseContext(serializeContext({ role: "customer", contextId: null }))).toEqual({
      role: "customer",
      contextId: null,
    });
  });

  it("rejects tampered values", () => {
    expect(parseContext("superuser")).toBeNull();
    expect(parseContext("dukandar:not-a-uuid")).toEqual({ role: "dukandar", contextId: null });
    expect(parseContext("")).toBeNull();
  });
});
