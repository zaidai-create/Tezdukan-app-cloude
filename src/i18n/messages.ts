import type en from "../../messages/en.json";
import type { Locale } from "./locales";

export type Messages = typeof en;

type Json = { [key: string]: Json | string };

const loaders: Record<Locale, () => Promise<{ default: Json }>> = {
  en: () => import("../../messages/en.json"),
  ur: () => import("../../messages/ur.json"),
  "ur-Latn": () => import("../../messages/ur-Latn.json"),
  sd: () => import("../../messages/sd.json"),
};

/** Fallback chain per locale; the last entry wins. English is always the base. */
const chains: Record<Locale, readonly Locale[]> = {
  en: ["en"],
  ur: ["en", "ur"],
  "ur-Latn": ["en", "ur-Latn"],
  sd: ["en", "ur", "sd"],
};

export function mergeMessages(base: Json, override: Json): Json {
  const out: Json = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    out[key] =
      typeof value === "object" && typeof current === "object"
        ? mergeMessages(current, value)
        : value;
  }
  return out;
}

export async function loadMessages(locale: Locale): Promise<Messages> {
  const layers = await Promise.all(chains[locale].map((l) => loaders[l]().then((m) => m.default)));
  return layers.reduce((acc, layer) => mergeMessages(acc, layer), {} as Json) as Messages;
}
