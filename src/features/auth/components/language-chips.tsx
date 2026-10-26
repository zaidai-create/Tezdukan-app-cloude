"use client";

import { cn } from "cn";
import { Languages } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { useLocaleSwitch } from "@/components/layout/use-locale-switch";
import { localeNames, pickerLocales } from "@/i18n/locales";

/**
 * First thing on the auth screens: pick a language. Switches in place, no reload; the
 * highlight slides to the new choice straight away.
 */
function LanguageChips({ className }: { className?: string }) {
  const t = useTranslations("settings");
  const { locale, switchLocale, pending } = useLocaleSwitch();
  const groupId = useId();
  return (
    <div
      role="radiogroup"
      aria-label={t("language")}
      aria-busy={pending || undefined}
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      <Languages aria-hidden className="size-5 text-muted" />
      <LayoutGroup id={groupId}>
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
                "relative inline-flex h-10 items-center rounded-full border border-border bg-surface px-4 text-sm font-semibold transition-colors duration-150 after:absolute after:inset-x-0 after:-inset-y-1",
                selected ? "text-primary-strong" : "text-ink hover:bg-subtle",
              )}
            >
              {selected ? (
                <motion.span
                  layoutId="language-pill"
                  aria-hidden
                  className="absolute -inset-px rounded-full border border-primary bg-primary-soft"
                  transition={{ type: "spring", stiffness: 520, damping: 38 }}
                />
              ) : null}
              <span className="relative">{localeNames[option]}</span>
            </button>
          );
        })}
      </LayoutGroup>
    </div>
  );
}

export { LanguageChips };
