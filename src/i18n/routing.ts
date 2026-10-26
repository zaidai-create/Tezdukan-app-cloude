import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales } from "./locales";

export const LOCALE_COOKIE = "NEXT_LOCALE";

export const routing = defineRouting({
  locales,
  defaultLocale,
  // The locale lives in a cookie, not the URL: links shared on WhatsApp open in the
  // recipient's own language, and pages still render statically per locale.
  localePrefix: "never",
  localeCookie: {
    name: LOCALE_COOKIE,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  },
  alternateLinks: false,
});
