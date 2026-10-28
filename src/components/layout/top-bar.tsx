"use client";

import { cn } from "cn";
import { Menu, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { LogoMark } from "@/components/brand/logo";
import { Kbd } from "@/components/ui/kbd";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { scopeOf } from "@/features/notifications/schemas";
import type { ShellSession } from "@/lib/auth/session-types";
import { CommandPalette, useCommandShortcut } from "./command-palette";
import { ContextButton } from "./context-button";
import type { NavGroup } from "./nav-config";
import { SidebarNav } from "./sidebar";
import { UserMenu } from "./user-menu";

/**
 * Desktop top bar: global search (opens the Ctrl+K palette, which also takes Munshi
 * commands), the active context and the user menu. On phones it adds a menu button that
 * opens the sidebar as a sheet.
 */
function TopBar({
  session,
  groups,
  className,
}: {
  session: ShellSession;
  groups: NavGroup[];
  className?: string;
}) {
  const t = useTranslations();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  useCommandShortcut(openPalette);
  const items = groups.flatMap((group) => group.items);

  return (
    <header
      className={cn(
        "pt-safe sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface px-4 lg:px-6",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label={t("nav.openMenu")}
        className="inline-flex size-11 items-center justify-center rounded-md text-ink hover:bg-subtle lg:hidden"
      >
        <Menu aria-hidden className="size-5" />
      </button>
      <ContextButton session={session} className="max-w-64" />
      <button
        type="button"
        onClick={openPalette}
        className="ms-auto flex h-11 w-full max-w-md items-center gap-3 rounded-md border border-border bg-canvas px-3 text-sm text-muted transition-colors hover:border-border-strong sm:ms-6"
      >
        <Search aria-hidden className="size-5" />
        <span className="flex-1 truncate text-start">{t("command.placeholder")}</span>
        <span className="hidden items-center gap-1 sm:flex">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
      <NotificationBell scope={scopeOf(session)} />
      <UserMenu session={session} />
      <CommandPalette items={items} open={paletteOpen} onOpenChange={setPaletteOpen} />
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="end" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <LogoMark className="size-8" />
              {t("common.menu")}
            </SheetTitle>
          </SheetHeader>
          <SheetBody>
            <SidebarNav groups={groups} onNavigate={() => setMenuOpen(false)} />
          </SheetBody>
        </SheetContent>
      </Sheet>
    </header>
  );
}

export { TopBar };
