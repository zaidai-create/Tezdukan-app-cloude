import { describe, it, expect } from "vitest";
import { canTransition } from "./machine";

describe("state machine", () => {
  it("allows the happy path", () => {
    expect(canTransition("WAITING_FOR_PDF", "PDF_RECEIVED")).toBe(true);
    expect(canTransition("PDF_RECEIVED", "WAITING_FOR_IMAGES")).toBe(true);
    expect(canTransition("WAITING_FOR_IMAGES", "IMAGES_RECEIVED")).toBe(true);
    expect(canTransition("IMAGES_RECEIVED", "COLLECTING_CHANGES")).toBe(true);
    expect(canTransition("COLLECTING_CHANGES", "CHANGE_SUMMARY")).toBe(true);
    expect(canTransition("CHANGE_SUMMARY", "APPROVED")).toBe(true);
    expect(canTransition("APPROVED", "PROCESSING")).toBe(true);
    expect(canTransition("PROCESSING", "QUALITY_CHECK")).toBe(true);
    expect(canTransition("QUALITY_CHECK", "COMPLETED")).toBe(true);
  });

  it("forbids illegal jumps", () => {
    expect(canTransition("WAITING_FOR_PDF", "COMPLETED")).toBe(false);
    expect(canTransition("COLLECTING_CHANGES", "APPROVED")).toBe(false);
    expect(canTransition("CHANGE_SUMMARY", "PROCESSING")).toBe(false);
    expect(canTransition("COMPLETED", "PROCESSING")).toBe(false);
  });

  it("supports cancellation from every open state", () => {
    const states = [
      "WAITING_FOR_PDF", "PDF_RECEIVED", "WAITING_FOR_IMAGES", "IMAGES_RECEIVED",
      "COLLECTING_CHANGES", "CHANGE_SUMMARY", "APPROVED", "PROCESSING", "QUALITY_CHECK",
    ] as const;
    for (const s of states) {
      expect(canTransition(s, "CANCELLED")).toBe(true);
    }
  });
});
