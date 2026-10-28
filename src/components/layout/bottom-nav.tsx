"use client";

import { cn } from "cn";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useChatUnread } from "@/features/chat/unread";
import { useCartCount } from "@/features/ordering/queries";
import { Link, usePathname } from "@/i18n/navigation";
import { haptic } from "@/lib/haptics";
import { isActive, type NavItem } from "./nav-config";
import { navIcons } from "./nav-icons";

const pillSpring = { type: "spring", stiffness: 480, damping: 38, mass: 0.8 } as const;

/**
 * Mobile tab bar as a floating, frosted dock. The current tab is a filled pill with its icon
 * and label; the pill slides to the tapped tab on a spring. Other tabs show the icon only,
 * with the label kept for screen readers and long-press tooltips.
 */
type BottomNavProps = {
  items: NavItem[];
  /** Small count on a tab icon, keyed by href (the cart's item count). */
  badges?: Partial<Record<string, number>>;
  className?: string;
};

function BottomNav(props: BottomNavProps) {
  return <BottomNavView {...props} pathname={usePathname()} />;
}

/**
 * The dock for a known path. On dynamic routes the path is request data, so the shell renders
 * this with no path (no tab lit) as the Suspense fallback until the real path is known.
 */
function BottomNavView({
  items,
  badges,
  className,
  pathname,
}: BottomNavProps & { pathname: string | null }) {
  const t = useTranslations("nav");
  const reduceMotion = useReducedMotion();
  const cartCount = useCartCount((s) => s.count);
  const chatUnread = useChatUnread((s) => s.count);

  return (
    <nav
      aria-label={t("primary")}
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(var(--safe-bottom)+var(--bottom-nav-gap))]",
        className,
      )}
    >
      <LayoutGroup id="bottom-nav">
        <ul
          data-slot="bottom-nav"
          className="material pointer-events-auto mx-auto flex h-(--bottom-nav-height) max-w-md items-center justify-between gap-1 rounded-full border border-material-edge px-2 shadow-float"
        >
          {items.map((item) => {
            const active = pathname !== null && isActive(pathname, item);
            const Icon = navIcons[item.icon];
            const label = t(item.label);
            const badge =
              badges?.[item.href] ??
              (item.icon === "cart" ? cartCount : item.icon === "chat" ? chatUnread : 0);
            return (
              <li key={item.href} className={cn("flex", active ? "shrink-0" : "flex-1")}>
                <Link
                  href={item.href}
                  prefetch
                  aria-current={active ? "page" : undefined}
                  title={active ? undefined : label}
                  onClick={() => {
                    if (!active) haptic("tap");
                  }}
                  className={cn(
                    "relative flex h-12 w-full items-center justify-center rounded-full transition-colors duration-150",
                    active ? "px-5 text-on-action" : "text-muted hover:text-ink active:scale-95",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="bottom-nav-pill"
                      aria-hidden
                      className="sheen absolute inset-0 rounded-full bg-action shadow-glow inset-shadow-edge"
                      transition={reduceMotion ? { duration: 0 } : pillSpring}
                    />
                  ) : null}
                  <span className="relative flex items-center gap-2">
                    <span className="relative">
                      <Icon aria-hidden className="size-6" />
                      {badge > 0 ? (
                        <span
                          aria-hidden
                          className="num absolute -end-2 -top-1.5 flex h-[18px] min-w-[18px] animate-pop items-center justify-center rounded-full bg-danger-ink px-1 text-[11px] leading-none font-bold text-on-danger ring-2 ring-surface"
                        >
                          {badge > 99 ? "99+" : badge}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        "text-base font-semibold whitespace-nowrap",
                        active ? "animate-rise" : "sr-only",
                      )}
                    >
                      {label}
                      {badge > 0 ? (
                        <span className="sr-only">{` (${t("badgeCount", { count: badge })})`}</span>
                      ) : null}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </LayoutGroup>
    </nav>
  );
}

export { BottomNav, BottomNavView };
