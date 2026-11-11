"use client";

import {
  Bike,
  BookOpen,
  Boxes,
  ChevronRight,
  FileText,
  Home,
  Languages,
  LifeBuoy,
  LogOut,
  MapPinned,
  type LucideIcon,
  MessageCircle,
  MessageSquareShare,
  Moon,
  Package,
  Plus,
  ReceiptText,
  ShieldCheck,
  Store,
  Sun,
  SunMoon,
  Trash2,
  Truck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "cn";
import { roleIcon } from "@/components/layout/nav-config";
import { RoleSwitcherSheet } from "@/components/layout/role-switcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { saveThemeAction } from "@/features/auth/actions";
import { LanguageChips } from "@/features/auth/components/language-chips";
import { useSignOut } from "@/features/auth/use-sign-out";
import { PushToggle } from "@/features/notifications/components/push-toggle";
import { Link } from "@/i18n/navigation";
import { roleHome, type AppRole } from "@/lib/auth/roles";
import { activeContextOf, type ShellSession } from "@/lib/auth/session-types";
import { whatsappHref } from "@/lib/contact";
import { publicEnv } from "@/lib/env";
import { formatPkMobile } from "@/lib/phone";
import { useTheme } from "@/lib/theme/use-theme";

type Tone = "primary" | "awning" | "neutral" | "danger";

const toneClass: Record<Tone, string> = {
  primary: "bg-primary-soft text-primary-strong",
  awning: "bg-awning-soft text-awning-ink",
  neutral: "bg-subtle text-ink",
  danger: "bg-danger-soft text-danger-ink",
};

/** An iOS-style inset group: small heading over one rounded card of rows. */
function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      {title ? <h2 className="px-4 text-sm font-semibold text-muted">{title}</h2> : null}
      <div className="overflow-hidden rounded-lg border border-border/60 bg-surface shadow-card">
        <div className="divide-y divide-border/70">{children}</div>
      </div>
    </section>
  );
}

function RowIcon({ icon: Icon, tone }: { icon: LucideIcon; tone: Tone }) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-md",
        toneClass[tone],
      )}
    >
      <Icon aria-hidden className="size-5" strokeWidth={1.75} />
    </span>
  );
}

const rowClass =
  "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-subtle/60 active:bg-subtle";

function RowBody({ label, hint }: { label: string; hint?: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block text-base font-semibold text-ink">{label}</span>
      {hint ? <span className="block text-sm text-muted">{hint}</span> : null}
    </span>
  );
}

const chevron = (
  <ChevronRight aria-hidden className="size-5 shrink-0 text-muted rtl:-scale-x-100" />
);

function LinkRow({
  href,
  icon,
  tone = "neutral",
  label,
  hint,
  external,
}: {
  href: string;
  icon: LucideIcon;
  tone?: Tone;
  label: string;
  hint?: string;
  external?: boolean;
}) {
  const body = (
    <>
      <RowIcon icon={icon} tone={tone} />
      <RowBody label={label} hint={hint} />
      {chevron}
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={rowClass}>
      {body}
    </a>
  ) : (
    <Link href={href} className={rowClass}>
      {body}
    </Link>
  );
}

type Tile = { href: string; icon: LucideIcon; label: string; tone: Tone };

function supportHref(role: AppRole): string {
  if (role === "dukandar") return "/dukan/chat/support";
  if (role === "distributor") return "/distributor/chat/support";
  return "/account/support";
}

/** Profile, roles, preferences, support and sign-out. Shared by every role's account page. */
function AccountView({ session }: { session: ShellSession }) {
  const t = useTranslations();
  const { preference, setPreference } = useTheme();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const { signOut, signingOut } = useSignOut();
  const name = session.fullName || formatPkMobile(session.phone ?? "");
  const active = activeContextOf(session);
  const role = session.activeRole;
  const help = supportHref(role);
  const hasDukan = session.contexts.some((context) => context.role === "dukandar");
  const hasDistributor = session.contexts.some((context) => context.role === "distributor");
  const supportWhatsapp = whatsappHref(publicEnv.NEXT_PUBLIC_SUPPORT_WHATSAPP);
  const ActiveIcon = roleIcon[role];

  const tiles: Tile[] =
    role === "dukandar"
      ? [
          {
            href: "/dukan/store",
            icon: Store,
            label: t("account.tiles.onlineDukan"),
            tone: "primary",
          },
          {
            href: "/dukan/orders",
            icon: Package,
            label: t("account.tiles.orders"),
            tone: "neutral",
          },
          {
            href: "/dukan/ledger",
            icon: BookOpen,
            label: t("account.tiles.khata"),
            tone: "awning",
          },
          { href: help, icon: LifeBuoy, label: t("account.tiles.help"), tone: "neutral" },
        ]
      : role === "distributor"
        ? [
            {
              href: "/distributor/orders",
              icon: Package,
              label: t("account.tiles.orders"),
              tone: "primary",
            },
            {
              href: "/distributor/catalog",
              icon: Boxes,
              label: t("account.tiles.catalog"),
              tone: "awning",
            },
            { href: help, icon: LifeBuoy, label: t("account.tiles.help"), tone: "neutral" },
          ]
        : role === "customer"
          ? [
              {
                href: "/orders",
                icon: Package,
                label: t("account.tiles.myOrders"),
                tone: "primary",
              },
              { href: "/shops", icon: Store, label: t("account.tiles.dukans"), tone: "awning" },
              { href: help, icon: LifeBuoy, label: t("account.tiles.help"), tone: "neutral" },
            ]
          : [
              { href: roleHome[role], icon: Home, label: t("account.tiles.home"), tone: "primary" },
              { href: help, icon: LifeBuoy, label: t("account.tiles.help"), tone: "neutral" },
            ];

  const setTheme = (next: string) => {
    if (next !== "light" && next !== "dark" && next !== "system") return;
    setPreference(next);
    void saveThemeAction(next);
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pb-10">
      <section className="-mx-4 flex flex-col items-center bg-gradient-to-b from-primary-soft via-mint-soft/40 to-canvas px-4 pt-8 pb-2 text-center">
        <Avatar className="size-24 shadow-raised ring-4 ring-surface">
          {session.avatarUrl ? <AvatarImage src={session.avatarUrl} alt="" /> : null}
          <AvatarFallback name={name} className="text-2xl" />
        </Avatar>
        <h1 className="mt-3 max-w-full truncate font-heading text-2xl font-bold text-ink">
          {name}
        </h1>
        {session.phone ? (
          <p dir="ltr" className="num text-base text-muted">
            {formatPkMobile(session.phone)}
          </p>
        ) : null}
        <span className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-semibold text-ink shadow-card">
          <ActiveIcon aria-hidden className="size-4 shrink-0 text-primary" />
          <span className="truncate">
            {active?.name ? `${active.name} · ${t(`roles.${role}`)}` : t(`roles.${role}`)}
          </span>
        </span>
      </section>

      <nav className={cn("grid gap-3", tiles.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {tiles.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-border/60 bg-surface p-3 text-center shadow-card transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            <RowIcon icon={tile.icon} tone={tile.tone} />
            <span className="text-sm font-semibold text-ink">{tile.label}</span>
          </Link>
        ))}
      </nav>

      {hasDukan || hasDistributor ? null : (
        <Link
          href="/start/dukan"
          className="flex items-center gap-4 rounded-xl border border-border/60 bg-surface p-4 shadow-raised"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-heading text-lg font-bold text-ink">
              {t("account.completeTitle")}
            </span>
            <span className="block text-sm font-semibold text-primary">
              {t("account.completeHint")}
            </span>
          </span>
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-awning-soft text-awning-ink">
            <Store aria-hidden className="size-7" strokeWidth={1.75} />
          </span>
        </Link>
      )}

      {session.contexts.length > 1 ? (
        <Group title={t("account.groups.roles")}>
          {session.contexts.map((context) => {
            const Icon = roleIcon[context.role];
            const isActive = context === active;
            return (
              <button
                key={`${context.role}:${context.contextId ?? ""}`}
                type="button"
                className={rowClass}
                onClick={() => setSwitcherOpen(true)}
              >
                <RowIcon icon={Icon} tone={isActive ? "primary" : "neutral"} />
                <RowBody
                  label={context.name ?? t(`roles.${context.role}`)}
                  hint={context.name ? t(`roles.${context.role}`) : undefined}
                />
                {isActive ? (
                  <StatusBadge tone="success">{t("roles.current")}</StatusBadge>
                ) : context.status === "pending" ? (
                  <StatusBadge tone="warning">{t("roles.awaitingApproval")}</StatusBadge>
                ) : context.status === "rejected" ? (
                  <StatusBadge tone="danger">{t("roles.rejected")}</StatusBadge>
                ) : (
                  chevron
                )}
              </button>
            );
          })}
        </Group>
      ) : null}

      {role === "customer" ? (
        <Group title={t("account.groups.delivery")}>
          <LinkRow
            href="/addresses?next=%2Faccount"
            icon={MapPinned}
            tone="primary"
            label={t("account.addresses")}
            hint={t("account.addressesHint")}
          />
        </Group>
      ) : null}

      <Group title={t("account.groups.preferences")}>
        {/* The choice sits under its label, full width: beside it, the three options squeezed
            the word "Appearance" down to a few letters on a phone. */}
        <div className="flex flex-col gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <RowIcon icon={SunMoon} tone="neutral" />
            <RowBody label={t("settings.appearance")} />
          </div>
          <ToggleGroup
            type="single"
            value={preference}
            onValueChange={setTheme}
            aria-label={t("settings.appearance")}
            className="grid w-full grid-cols-3"
          >
            <ToggleGroupItem value="light" className="h-11">
              <Sun aria-hidden />
              {t("account.appearanceLight")}
            </ToggleGroupItem>
            <ToggleGroupItem value="dark" className="h-11">
              <Moon aria-hidden />
              {t("account.appearanceDark")}
            </ToggleGroupItem>
            <ToggleGroupItem value="system" className="h-11">
              <SunMoon aria-hidden />
              {t("account.appearanceAuto")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex flex-col gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <RowIcon icon={Languages} tone="neutral" />
            <RowBody label={t("settings.language")} hint={t("settings.languageHint")} />
          </div>
          <LanguageChips />
        </div>
        <PushToggle className="rounded-none border-0 shadow-none" />
      </Group>

      <Group title={t("account.groups.support")}>
        <LinkRow
          href={help}
          icon={MessageCircle}
          tone="primary"
          label={t("account.liveChat")}
          hint={t("account.helpHint")}
        />
        {supportWhatsapp ? (
          <LinkRow
            href={supportWhatsapp}
            external
            icon={MessageSquareShare}
            tone="primary"
            label={t("account.whatsappSupport")}
          />
        ) : null}
        <LinkRow href="/terms" icon={FileText} label={t("account.terms")} />
        <LinkRow href="/privacy" icon={ShieldCheck} label={t("account.privacy")} />
        <LinkRow href="/refund-policy" icon={ReceiptText} label={t("account.refund")} />
      </Group>

      <Group title={t("account.groups.opportunities")}>
        {hasDukan ? null : (
          <LinkRow
            href="/start/dukan"
            icon={Plus}
            tone="awning"
            label={t("account.registerDukan")}
          />
        )}
        {hasDistributor ? null : (
          <LinkRow
            href="/start/distributor"
            icon={Truck}
            tone="awning"
            label={t("account.becomeDistributor")}
          />
        )}
        <LinkRow
          href={help}
          icon={Bike}
          tone="awning"
          label={t("account.joinRider")}
          hint={t("account.joinRiderHint")}
        />
      </Group>

      <Group>
        <LinkRow
          href="/data-deletion"
          icon={Trash2}
          tone="danger"
          label={t("account.deleteAccount")}
          hint={t("account.deleteAccountHint")}
        />
      </Group>

      <Group>
        <button
          type="button"
          className={cn(rowClass, "justify-center text-danger-ink")}
          disabled={signingOut}
          onClick={signOut}
        >
          <LogOut aria-hidden className="size-5" />
          <span className="text-base font-semibold">{t("common.signOut")}</span>
        </button>
      </Group>

      <RoleSwitcherSheet session={session} open={switcherOpen} onOpenChange={setSwitcherOpen} />
    </div>
  );
}

export { AccountView };
