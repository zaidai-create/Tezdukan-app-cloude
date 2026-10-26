import {
  Bike,
  House,
  LayoutDashboard,
  type LucideIcon,
  MapPinned,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { NavIcon } from "./nav-config";

export const navIcons: Record<NavIcon, LucideIcon> = {
  home: House,
  account: UserRound,
  dashboard: LayoutDashboard,
  beat: MapPinned,
  today: Bike,
  admin: ShieldCheck,
};
