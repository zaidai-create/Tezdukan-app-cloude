import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "./en.json";
import sd from "./sd.json";
import ur from "./ur.json";
import urLatn from "./ur-Latn.json";

type Json = { [key: string]: Json | string };

function flatten(obj: Json, prefix = ""): Record<string, string> {
  return Object.entries(obj).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") acc[path] = value;
    else Object.assign(acc, flatten(value, path));
    return acc;
  }, {});
}

const base = flatten(en);
const complete = { ur: flatten(ur), "ur-Latn": flatten(urLatn) };
const EMOJI = /\p{Extended_Pictographic}/u;

describe("message catalogues", () => {
  it.each(Object.entries(complete))("%s has exactly the English keys", (_locale, messages) => {
    expect(Object.keys(messages).sort()).toEqual(Object.keys(base).sort());
  });

  it("Sindhi only contains keys that exist in English (it falls back to Urdu)", () => {
    for (const key of Object.keys(flatten(sd))) expect(base).toHaveProperty([key]);
  });

  it.each([
    ["en", en],
    ["ur", ur],
    ["ur-Latn", urLatn],
    ["sd", sd],
  ] as const)("%s has no emoji and no empty strings", (_locale, messages) => {
    for (const [key, value] of Object.entries(flatten(messages as Json))) {
      expect(value.trim(), key).not.toBe("");
      expect(EMOJI.test(value), key).toBe(false);
    }
  });

  it.each([
    ["en", en],
    ["ur", ur],
    ["ur-Latn", urLatn],
  ] as const)("%s messages are valid ICU and keep their placeholders", (locale, messages) => {
    const t = createTranslator({
      locale,
      messages: messages as Json,
      onError: (error) => {
        throw error;
      },
    });
    for (const [key, english] of Object.entries(base)) {
      const placeholders = [...english.matchAll(/\{(\w+)/g)].map((m) => m[1] as string);
      const values = Object.fromEntries(
        placeholders.map((p) => [p, p === "count" || p === "seconds" || p === "percent" ? 3 : "x"]),
      );
      expect(() => t(key as never, values as never), `${locale}:${key}`).not.toThrow();
      const own = flatten(messages as Json)[key] ?? "";
      for (const placeholder of placeholders)
        expect(own, `${locale}:${key}`).toContain(`{${placeholder}`);
    }
  });
});
