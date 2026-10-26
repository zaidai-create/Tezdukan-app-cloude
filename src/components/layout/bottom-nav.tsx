"use client";

import { cn } from "cn";
import { Mic } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { useMunshi } from "@/components/munshi/munshi-store";
import { Link, usePathname } from "@/i18n/navigation";
import { haptic } from "@/lib/haptics";
import { isActive, type NavItem } from "./nav-config";
import { navIcons } from "./nav-icons";

const HOLD_MS = 350;

/**
 * Mobile bottom navigation: up to four tabs with the raised Munshi mic in the centre.
 * Tap the mic to open Munshi; press and hold to start talking straight away.
 */
function BottomNav({ items, className }: { items: NavItem[]; className?: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const openMunshi = useMunshi((s) => s.openMunshi);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  const half = Math.ceil(items.length / 2);
  const before = items.slice(0, half);
  const after = items.slice(half);

  const tab = (item: NavItem) => {
    const active = isActive(pathname, item);
    const Icon = navIcons[item.icon];
    return (
      <li key={item.href} className="flex flex-1">
        <Link
          href={item.href}
          prefetch
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex h-full w-full flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors",
            active ? "text-primary-strong" : "text-muted hover:text-ink",
          )}
        >
          <span
            className={cn(
              "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
              active && "bg-primary-soft",
            )}
          >
            <Icon aria-hidden className="size-[22px]" />
          </span>
          {t(item.label)}
        </Link>
      </li>
    );
  };

  return (
    <nav
      aria-label={t("primary")}
      className={cn(
        "pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface shadow-[0_-1px_0_0_var(--border)]",
        className,
      )}
    >
      <ul className="mx-auto flex h-(--bottom-nav-height) max-w-xl items-stretch">
        {before.map(tab)}
        <li className="flex flex-1 justify-center">
          <button
            type="button"
            aria-label={t("munshiHint")}
            className="group flex flex-col items-center justify-end gap-1 pb-1.5 text-xs font-semibold text-ink select-none"
            onPointerDown={() => {
              held.current = false;
              holdTimer.current = setTimeout(() => {
                held.current = true;
                haptic("tap");
                openMunshi({ listen: true });
              }, HOLD_MS);
            }}
            onPointerUp={() => {
              if (holdTimer.current) clearTimeout(holdTimer.current);
            }}
            onPointerLeave={() => {
              if (holdTimer.current) clearTimeout(holdTimer.current);
            }}
            onClick={() => {
              if (held.current) return;
              haptic("tap");
              openMunshi();
            }}
            onContextMenu={(event) => event.preventDefault()}
          >
            <span className="-mt-6 flex size-14 items-center justify-center rounded-full bg-action text-on-action shadow-raised ring-4 ring-surface transition-transform duration-150 group-active:scale-95">
              <Mic aria-hidden className="size-6" />
            </span>
            {t("munshi")}
          </button>
        </li>
        {after.map(tab)}
      </ul>
    </nav>
  );
}

export { BottomNav };
