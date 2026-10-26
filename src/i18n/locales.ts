export const locales = ["en", "ur", "ur-Latn", "sd"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Locales offered in the language picker. Sindhi is wired up but hidden until reviewed. */
export const pickerLocales: readonly Locale[] = ["en", "ur", "ur-Latn"];

const rtl: ReadonlySet<Locale> = new Set<Locale>(["ur", "sd"]);

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export function localeDir(locale: Locale): "rtl" | "ltr" {
  return rtl.has(locale) ? "rtl" : "ltr";
}

/** Language names are shown in their own script so people can find their language. */
export const localeNames: Record<Locale, string> = {
  en: "English",
  ur: "اردو",
  "ur-Latn": "Roman Urdu",
  sd: "سنڌي",
};

/** BCP 47 tags for the Web Speech API (voice input and read-aloud). */
export const speechLang: Record<Locale, string> = {
  en: "en-PK",
  ur: "ur-PK",
  "ur-Latn": "ur-PK",
  sd: "sd-PK",
};
