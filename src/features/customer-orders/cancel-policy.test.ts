import { describe, expect, it } from "vitest";
import { CANCEL_GRACE_MS, cancelStateOf } from "./cancel-policy";

const now = Date.parse("2026-11-12T10:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();

describe("cancelStateOf", () => {
  it("lets a placed order go freely", () => {
    expect(cancelStateOf({ status: "placed", accepted_at: null }, now)).toEqual({ kind: "free" });
  });

  it("gives a short window after the dukan accepts", () => {
    expect(cancelStateOf({ status: "accepted", accepted_at: ago(30_000) }, now)).toEqual({
      kind: "grace",
      endsAt: now - 30_000 + CANCEL_GRACE_MS,
    });
  });

  it("closes the window once it has passed, or when the time is unknown", () => {
    expect(cancelStateOf({ status: "accepted", accepted_at: ago(CANCEL_GRACE_MS) }, now)).toEqual({
      kind: "too_late",
    });
    expect(cancelStateOf({ status: "accepted", accepted_at: null }, now)).toEqual({
      kind: "too_late",
    });
  });

  it("never lets a packed or travelling order be cancelled by the customer", () => {
    expect(cancelStateOf({ status: "packed", accepted_at: ago(1000) }, now).kind).toBe("too_late");
    expect(cancelStateOf({ status: "out_for_delivery", accepted_at: null }, now).kind).toBe(
      "too_late",
    );
  });

  it("has nothing to cancel on a finished order", () => {
    for (const status of ["delivered", "cancelled", "rejected"] as const) {
      expect(cancelStateOf({ status, accepted_at: null }, now)).toEqual({ kind: "none" });
    }
  });
});
