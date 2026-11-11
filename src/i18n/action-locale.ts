import "server-only";
import { cookies } from "next/headers";
import { defaultLocale, isLocale, type Locale } from "./locales";
import { LOCALE_COOKIE } from "./routing";

/**
 * The person's language inside a Server Action or Route Handler. Those run outside a route,
 * so `getLocale()` has nothing to read; the language cookie is the same source the proxy uses.
 */
export async function actionLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}
