import {
  Bike,
  CircleUserRound,
  House,
  LayoutDashboard,
  LayoutGrid,
  type LucideIcon,
  MapPinned,
  MessageCircle,
  Package,
  ShieldCheck,
  ShoppingBasket,
  Store,
  Wallet,
} from "lucide-react";
import type { NavIcon } from "./nav-config";

export const navIcons: Record<NavIcon, LucideIcon> = {
  home: House,
  categories: LayoutGrid,
  cart: ShoppingBasket,
  orders: Package,
  dukan: Store,
  ledger: Wallet,
  chat: MessageCircle,
  account: CircleUserRound,
  dashboard: LayoutDashboard,
  beat: MapPinned,
  today: Bike,
  admin: ShieldCheck,
};
