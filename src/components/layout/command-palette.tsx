"use client";

import { Languages, Mic, Moon, SunMedium } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { useMunshi } from "@/components/munshi/munshi-store";
import { saveThemeAction } from "@/features/auth/actions";
import { localeNames, pickerLocales } from "@/i18n/locales";
import { useRouter } from "@/i18n/navigation";
import { useTheme } from "@/lib/theme/use-theme";
import type { NavItem } from "./nav-config";
import { navIcons } from "./nav-icons";
import { useLocaleSwitch } from "./use-locale-switch";

type CommandPaletteProps = {
  items: NavItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Opens on Ctrl+K / ⌘K. */
function useCommandShortcut(onOpen: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpen]);
}

/**
 * Ctrl+K palette: jump to any page of the current role, change language or theme, or hand the
 * typed text to Munshi ("aaj ke pending orders dikhao").
 */
function CommandPalette({ items, open, onOpenChange }: CommandPaletteProps) {
  const t = useTranslations();
  const router = useRouter();
  const openMunshi = useMunshi((s) => s.openMunshi);
  const { resolved, setPreference } = useTheme();
  const { switchLocale } = useLocaleSwitch();
  const [query, setQuery] = useState("");

  const run = (fn: () => void) => {
    onOpenChange(false);
    setQuery("");
    fn();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("command.title")}
      description={t("command.description")}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={t("command.placeholder")}
        endSlot={<Kbd>Esc</Kbd>}
      />
      <CommandList>
        <CommandEmpty>{t("command.empty")}</CommandEmpty>
        <CommandGroup heading={t("command.goTo")}>
          {items.map((item) => {
            const Icon = navIcons[item.icon];
            return (
              <CommandItem
                key={item.href}
                value={`${t(`nav.${item.label}`)} ${item.href}`}
                onSelect={() => run(() => router.push(item.href))}
              >
                <Icon aria-hidden />
                {t(`nav.${item.label}`)}
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandGroup heading={t("common.settings")}>
          <CommandItem
            value={t("settings.darkMode")}
            onSelect={() =>
              run(() => {
                const next = resolved === "dark" ? "light" : "dark";
                setPreference(next);
                void saveThemeAction(next);
              })
            }
          >
            {resolved === "dark" ? <SunMedium aria-hidden /> : <Moon aria-hidden />}
            {resolved === "dark" ? t("settings.lightMode") : t("settings.darkMode")}
          </CommandItem>
          {pickerLocales.map((option) => (
            <CommandItem
              key={option}
              value={`${t("settings.language")} ${localeNames[option]}`}
              onSelect={() => run(() => switchLocale(option))}
            >
              <Languages aria-hidden />
              <span lang={option}>{localeNames[option]}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        {/* Asking Munshi is the fallback: always offered, never outranks a matching page, and
            the only choice (so Enter asks) when the text is a question rather than a page. */}
        {query.trim().length > 1 ? (
          <CommandGroup heading={t("nav.munshi")} forceMount>
            <CommandItem
              value="ask-munshi"
              forceMount
              onSelect={() => run(() => openMunshi({ draft: query.trim() }))}
            >
              <Mic aria-hidden className="text-primary-strong" />
              <span className="truncate">{t("command.askMunshi", { query: query.trim() })}</span>
              <CommandShortcut>↵</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}

export { CommandPalette, useCommandShortcut };
