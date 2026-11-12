import { describe, expect, it } from "vitest";
import { replyLanguage } from "./language";

describe("replyLanguage", () => {
  it("answers Urdu script in Urdu script", () => {
    expect(replyLanguage("میرا آرڈر کہاں ہے؟")).toBe("Urdu (Urdu script)");
  });

  it("recognises Roman Urdu", () => {
    expect(replyLanguage("order cancel kaise karun?")).toBe("Roman Urdu");
    expect(replyLanguage("Cheeni kharab nikli, mujhe paise wapas chahiye")).toBe("Roman Urdu");
    expect(replyLanguage("mera order kahan hai?")).toBe("Roman Urdu");
  });

  it("keeps English in English", () => {
    expect(replyLanguage("Where is my order?")).toBe("English");
    expect(replyLanguage("How do I cancel an order?")).toBe("English");
  });
});
