"use client";

import { Check, Languages, LogOut, Moon, Repeat, Settings, SunMedium } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { saveThemeAction } from "@/features/auth/actions";
import { useSignOut } from "@/features/auth/use-sign-out";
import { localeNames, pickerLocales } from "@/i18n/locales";
import { useRouter } from "@/i18n/navigation";
import { accountPath } from "@/lib/auth/roles";
import type { ShellSession } from "@/lib/auth/session-types";
import { formatPkMobile } from "@/lib/phone";
import { useTheme } from "@/lib/theme/use-theme";
import { RoleSwitcherSheet } from "./role-switcher";
import { useLocaleSwitch } from "./use-locale-switch";

function UserMenu({ session }: { session: ShellSession }) {
  const t = useTranslations();
  const router = useRouter();
  const { resolved, setPreference } = useTheme();
  const { locale, switchLocale } = useLocaleSwitch();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const { signOut, signingOut } = useSignOut();
  const name = session.fullName || formatPkMobile(session.phone ?? "");

  const toggleDark = () => {
    const next = resolved === "dark" ? "light" : "dark";
    setPreference(next);
    void saveThemeAction(next);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="relative rounded-full after:absolute after:-inset-1"
          aria-label={t("common.menu")}
        >
          <Avatar className="size-10">
            {session.avatarUrl ? <AvatarImage src={session.avatarUrl} alt="" /> : null}
            <AvatarFallback name={name} />
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="flex flex-col gap-0.5 px-3 py-2 text-sm font-normal">
            <span className="truncate text-base font-semibold text-ink">{name}</span>
            {session.phone ? (
              <span dir="ltr" className="num text-start text-muted">
                {formatPkMobile(session.phone)}
              </span>
            ) : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {session.contexts.length > 1 ? (
            <DropdownMenuItem onSelect={() => setSwitcherOpen(true)}>
              <Repeat aria-hidden />
              {t("roles.switchRole")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Languages aria-hidden />
              {t("settings.language")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-44">
              {pickerLocales.map((option) => (
                <DropdownMenuItem key={option} lang={option} onSelect={() => switchLocale(option)}>
                  {localeNames[option]}
                  {option === locale ? (
                    <Check aria-hidden className="ms-auto text-primary-strong" />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onSelect={toggleDark}>
            {resolved === "dark" ? <SunMedium aria-hidden /> : <Moon aria-hidden />}
            {resolved === "dark" ? t("settings.lightMode") : t("settings.darkMode")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push(accountPath(session.activeRole))}>
            <Settings aria-hidden />
            {t("common.settings")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="danger" disabled={signingOut} onSelect={signOut}>
            <LogOut aria-hidden />
            {t("common.signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RoleSwitcherSheet session={session} open={switcherOpen} onOpenChange={setSwitcherOpen} />
    </>
  );
}

export { UserMenu };
