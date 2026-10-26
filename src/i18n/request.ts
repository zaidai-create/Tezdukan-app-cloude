import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { formats } from "./formats";
import { loadMessages } from "./messages";
import { routing } from "./routing";

export default getRequestConfig(async ({ locale }) => {
  // Route Handlers and Server Actions pass the locale explicitly; pages read the root param.
  let resolved = locale;
  if (!resolved) {
    const fromParams = await rootParams.locale();
    if (!hasLocale(routing.locales, fromParams)) notFound();
    resolved = fromParams;
  }
  if (!hasLocale(routing.locales, resolved)) notFound();

  return {
    locale: resolved,
    messages: await loadMessages(resolved),
    timeZone: "Asia/Karachi",
    formats,
  };
});
