"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { saveLocaleAction } from "@/features/auth/actions";
import { localeDir, type Locale } from "@/i18n/locales";
import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * Switch language in place: next-intl updates the NEXT_LOCALE cookie, the page re-renders on
 * the server in the new language, and `dir` flips immediately so the layout mirrors without
 * waiting. The choice is also saved on the profile for other devices.
 */
export function useLocaleSwitch() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const switchLocale = (next: Locale) => {
    if (next === locale) return;
    document.documentElement.lang = next;
    document.documentElement.dir = localeDir(next);
    startTransition(() => {
      router.replace(pathname, { locale: next });
      router.refresh();
    });
    void saveLocaleAction(next);
  };

  return { locale, switchLocale, pending };
}
