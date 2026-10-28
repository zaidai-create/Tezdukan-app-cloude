"use client";

import { cn } from "cn";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense, useSyncExternalStore } from "react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link, usePathname } from "@/i18n/navigation";
import { isActive, type NavGroup } from "./nav-config";
import { navIcons } from "./nav-icons";

const STORAGE_KEY = "td_sidebar_collapsed";
const listeners = new Set<() => void>();

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false; // Storage unavailable (private mode): start expanded.
  }
}

function writeCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // The preference just won't persist.
  }
  for (const listener of listeners) listener();
}

function useCollapsed() {
  const collapsed = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    readCollapsed,
    () => false,
  );
  return { collapsed, toggle: () => writeCollapsed(!collapsed) };
}

type SidebarNavProps = {
  groups: NavGroup[];
  collapsed?: boolean;
  onNavigate?: () => void;
};

function SidebarNav(props: SidebarNavProps) {
  return <SidebarNavView {...props} pathname={usePathname()} />;
}

/** The links for a known path; with no path (dynamic routes, before it is known) none is lit. */
function SidebarNavView({
  groups,
  collapsed = false,
  onNavigate,
  pathname,
}: SidebarNavProps & { pathname: string | null }) {
  const t = useTranslations("nav");
  return (
    <nav aria-label={t("primary")} className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          {collapsed ? null : (
            <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">
              {t(`groups.${group.label}`)}
            </p>
          )}
          {group.items.map((item) => {
            const active = pathname !== null && isActive(pathname, item);
            const Icon = navIcons[item.icon];
            const link = (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors",
                  active ? "bg-primary-soft text-primary-strong" : "text-ink hover:bg-subtle",
                  collapsed && "justify-center px-0",
                )}
              >
                <Icon
                  aria-hidden
                  className={cn("size-5", active ? "text-primary-strong" : "text-muted")}
                />
                {collapsed ? <span className="sr-only">{t(item.label)}</span> : t(item.label)}
              </Link>
            );
            return collapsed ? (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{t(item.label)}</TooltipContent>
              </Tooltip>
            ) : (
              link
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Collapsible desktop sidebar (distributor, admin, dukandar on large screens). */
function Sidebar({
  groups,
  footer,
  className,
}: {
  groups: NavGroup[];
  footer?: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("nav");
  const { collapsed, toggle } = useCollapsed();
  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-e border-border bg-surface transition-[width] duration-200 lg:flex",
        collapsed ? "w-[72px]" : "w-64",
        className,
      )}
    >
      <div className={cn("flex h-16 items-center px-4", collapsed && "justify-center px-0")}>
        <Link href="/" aria-label={t("home")}>
          {collapsed ? <LogoMark className="size-9" /> : <Logo markClassName="size-9" />}
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <Suspense
          fallback={<SidebarNavView groups={groups} collapsed={collapsed} pathname={null} />}
        >
          <SidebarNav groups={groups} collapsed={collapsed} />
        </Suspense>
      </div>
      {footer && !collapsed ? <div className="border-t border-border p-3">{footer}</div> : null}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className={cn(
          "m-3 flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted hover:bg-subtle hover:text-ink",
          collapsed && "justify-center px-0",
        )}
      >
        {collapsed ? (
          <PanelLeftOpen aria-hidden className="size-5 rtl:-scale-x-100" />
        ) : (
          <PanelLeftClose aria-hidden className="size-5 rtl:-scale-x-100" />
        )}
        <span className={cn(collapsed && "sr-only")}>
          {collapsed ? t("expand") : t("collapse")}
        </span>
      </button>
    </aside>
  );
}

export { Sidebar, SidebarNav };
