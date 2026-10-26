"use client";

import { LogOut, Repeat } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { RoleSwitcherSheet } from "@/components/layout/role-switcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import { saveThemeAction } from "@/features/auth/actions";
import { useSignOut } from "@/features/auth/use-sign-out";
import { LanguageChips } from "@/features/auth/components/language-chips";
import { activeContextOf, type ShellSession } from "@/lib/auth/session-types";
import { formatPkMobile } from "@/lib/phone";
import { useTheme } from "@/lib/theme/use-theme";

function SettingRow({
  title,
  hint,
  control,
}: {
  title: string;
  hint?: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="text-base font-semibold text-ink">{title}</p>
        {hint ? <p className="text-sm text-muted">{hint}</p> : null}
      </div>
      {control}
    </div>
  );
}

/** Profile, roles, language, theme and sign-out. Shared by every role's account page. */
function AccountView({ session }: { session: ShellSession }) {
  const t = useTranslations();
  const { preference, resolved, setPreference } = useTheme();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const { signOut, signingOut } = useSignOut();
  const name = session.fullName || formatPkMobile(session.phone ?? "");
  const active = activeContextOf(session);

  const setTheme = (next: "light" | "dark" | "system") => {
    setPreference(next);
    void saveThemeAction(next);
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
      <section className="flex items-center gap-4">
        <Avatar className="size-16">
          {session.avatarUrl ? <AvatarImage src={session.avatarUrl} alt="" /> : null}
          <AvatarFallback name={name} className="text-lg" />
        </Avatar>
        <div className="min-w-0">
          <h1 className="truncate font-heading text-2xl font-bold text-ink">{name}</h1>
          {session.phone ? (
            <p dir="ltr" className="num text-start text-base text-muted">
              {formatPkMobile(session.phone)}
            </p>
          ) : null}
        </div>
      </section>

      <Card>
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
          <h2 className="font-heading text-lg font-semibold text-ink">{t("account.yourRoles")}</h2>
          {session.contexts.length > 1 ? (
            <Button variant="soft" size="sm" onClick={() => setSwitcherOpen(true)}>
              <Repeat aria-hidden />
              {t("roles.switchRole")}
            </Button>
          ) : null}
        </div>
        <ul className="divide-y divide-border">
          {session.contexts.map((context) => {
            const isActive = context === active;
            return (
              <li
                key={`${context.role}:${context.contextId ?? ""}`}
                className="flex min-h-14 items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-ink">
                    {context.name ?? t(`roles.${context.role}`)}
                  </p>
                  {context.name ? (
                    <p className="text-sm text-muted">{t(`roles.${context.role}`)}</p>
                  ) : null}
                </div>
                {isActive ? (
                  <StatusBadge tone="success">{t("roles.current")}</StatusBadge>
                ) : context.status === "pending" ? (
                  <StatusBadge tone="warning">{t("roles.awaitingApproval")}</StatusBadge>
                ) : context.status === "rejected" ? (
                  <StatusBadge tone="danger">{t("roles.rejected")}</StatusBadge>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <h2 className="px-4 pt-4 font-heading text-lg font-semibold text-ink">
          {t("settings.language")}
        </h2>
        <p className="px-4 text-sm text-muted">{t("settings.languageHint")}</p>
        <LanguageChips className="px-4 pt-3 pb-4" />
      </Card>

      <Card className="divide-y divide-border">
        <h2 className="px-4 pt-4 pb-2 font-heading text-lg font-semibold text-ink">
          {t("settings.appearance")}
        </h2>
        <SettingRow
          title={t("settings.darkMode")}
          hint={t("settings.darkModeHint")}
          control={
            <Switch
              checked={resolved === "dark"}
              onCheckedChange={(on) => setTheme(on ? "dark" : "light")}
              aria-label={t("settings.darkMode")}
            />
          }
        />
        <SettingRow
          title={t("settings.matchDevice")}
          hint={t("settings.matchDeviceHint")}
          control={
            <Switch
              checked={preference === "system"}
              onCheckedChange={(on) => setTheme(on ? "system" : resolved)}
              aria-label={t("settings.matchDevice")}
            />
          }
        />
      </Card>

      <Button variant="danger-soft" size="lg" block loading={signingOut} onClick={signOut}>
        {signingOut ? null : <LogOut aria-hidden />}
        {t("common.signOut")}
      </Button>

      <RoleSwitcherSheet session={session} open={switcherOpen} onOpenChange={setSwitcherOpen} />
    </div>
  );
}

export { AccountView };
