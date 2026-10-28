import {
  Bike,
  ClipboardList,
  type LucideIcon,
  Route,
  ShieldCheck,
  ShoppingBag,
  Store,
} from "lucide-react";
import type { AppRole } from "@/lib/auth/roles";

/**
 * Navigation per role. Only routes that exist are listed: each later phase adds its items
 * here as the screens ship, so there is never a link to a page that isn't built.
 * Labels are keys in the `nav` message namespace.
 */
export type NavLabel =
  | "home"
  | "categories"
  | "cart"
  | "orders"
  | "dukan"
  | "ledger"
  | "distributors"
  | "chat"
  | "support"
  | "catalog"
  | "account"
  | "dashboard"
  | "beat"
  | "today"
  | "trips"
  | "settlement"
  | "overview"
  | "verifications";

/** Icon names, resolved to Lucide components in client code (components cannot be passed
 * from the server shell to client components as props). */
export type NavIcon =
  | "home"
  | "categories"
  | "cart"
  | "orders"
  | "dukan"
  | "ledger"
  | "chat"
  | "support"
  | "catalog"
  | "account"
  | "dashboard"
  | "beat"
  | "today"
  | "admin";

export type NavItem = { href: string; label: NavLabel; icon: NavIcon; exact?: boolean };
export type NavGroup = { label: "main" | "account"; items: NavItem[] };

/** Mobile bottom nav (the floating dock): up to five tabs. Munshi lives in the header. */
export const mobileTabs: Partial<Record<AppRole, NavItem[]>> = {
  customer: [
    { href: "/", label: "home", icon: "home", exact: true },
    { href: "/account", label: "account", icon: "account" },
  ],
  dukandar: [
    { href: "/dukan", label: "home", icon: "home", exact: true },
    { href: "/dukan/categories", label: "categories", icon: "categories" },
    { href: "/dukan/cart", label: "cart", icon: "cart" },
    { href: "/dukan/orders", label: "orders", icon: "orders" },
    { href: "/dukan/account", label: "account", icon: "account" },
  ],
  booker: [
    { href: "/booker", label: "beat", icon: "beat", exact: true },
    { href: "/booker/account", label: "account", icon: "account" },
  ],
  rider: [
    { href: "/rider", label: "today", icon: "today", exact: true },
    { href: "/rider/account", label: "account", icon: "account" },
  ],
  // Distributors run the portal from a phone as often as from a desk.
  distributor: [
    { href: "/distributor", label: "home", icon: "home", exact: true },
    { href: "/distributor/orders", label: "orders", icon: "orders" },
    { href: "/distributor/catalog", label: "catalog", icon: "catalog" },
    { href: "/distributor/chat", label: "chat", icon: "chat" },
    { href: "/distributor/account", label: "account", icon: "account" },
  ],
};

/** Desktop sidebar groups for desktop-first roles (and dukandar on large screens). */
export const sidebarGroups: Partial<Record<AppRole, NavGroup[]>> = {
  distributor: [
    {
      label: "main",
      items: [
        { href: "/distributor", label: "dashboard", icon: "dashboard", exact: true },
        { href: "/distributor/orders", label: "orders", icon: "orders" },
        { href: "/distributor/catalog", label: "catalog", icon: "catalog" },
        { href: "/distributor/chat", label: "chat", icon: "chat" },
      ],
    },
    {
      label: "account",
      items: [{ href: "/distributor/account", label: "account", icon: "account" }],
    },
  ],
  admin: [
    {
      label: "main",
      items: [
        { href: "/admin", label: "overview", icon: "admin", exact: true },
        { href: "/admin/support", label: "support", icon: "support" },
      ],
    },
    { label: "account", items: [{ href: "/admin/account", label: "account", icon: "account" }] },
  ],
  dukandar: [
    {
      label: "main",
      items: [
        { href: "/dukan", label: "home", icon: "home", exact: true },
        { href: "/dukan/categories", label: "categories", icon: "categories" },
        { href: "/dukan/cart", label: "cart", icon: "cart" },
        { href: "/dukan/orders", label: "orders", icon: "orders" },
        { href: "/dukan/ledger", label: "ledger", icon: "ledger" },
        { href: "/dukan/distributors", label: "distributors", icon: "dukan" },
        { href: "/dukan/chat", label: "chat", icon: "chat" },
      ],
    },
    { label: "account", items: [{ href: "/dukan/account", label: "account", icon: "account" }] },
  ],
};

/** Icon shown for each role in the role switcher. */
export const roleIcon: Record<AppRole, LucideIcon> = {
  customer: ShoppingBag,
  dukandar: Store,
  distributor: ClipboardList,
  booker: Route,
  rider: Bike,
  admin: ShieldCheck,
};

export function isActive(pathname: string, item: Pick<NavItem, "href" | "exact">): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
