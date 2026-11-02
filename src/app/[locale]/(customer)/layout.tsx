import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { CustomerCartBadgeSync } from "@/features/storefront/cart-store";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <AppShell role="customer">
      <CustomerCartBadgeSync />
      {children}
    </AppShell>
  );
}
