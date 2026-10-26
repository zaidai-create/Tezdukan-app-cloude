"use client";

import { cn } from "cn";
import { Languages } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLocaleSwitch } from "@/components/layout/use-locale-switch";
import { localeNames, pickerLocales } from "@/i18n/locales";

/** First thing on the auth screens: pick a language. Switches in place, no reload. */
function LanguageChips({ className }: { className?: string }) {
  const t = useTranslations("settings");
  const { locale, switchLocale, pending } = useLocaleSwitch();
  return (
    <div
      role="radiogroup"
      aria-label={t("language")}
      aria-busy={pending || undefined}
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      <Languages aria-hidden className="size-5 text-muted" />
      {pickerLocales.map((option) => {
        const selected = option === locale;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            lang={option}
            onClick={() => switchLocale(option)}
            className={cn(
              "relative inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold transition-colors after:absolute after:inset-x-0 after:-inset-y-1",
              selected
                ? "border-primary bg-primary-soft text-primary-strong"
                : "border-border bg-surface text-ink hover:bg-subtle",
            )}
          >
            {localeNames[option]}
          </button>
        );
      })}
    </div>
  );
}

export { LanguageChips };
