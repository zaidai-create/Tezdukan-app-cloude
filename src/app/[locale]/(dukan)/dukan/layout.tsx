import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { DukanCartCount } from "@/features/ordering/components/dukan-cart-count";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <AppShell role="dukandar">
      {children}
      <Suspense fallback={null}>
        <DukanCartCount />
      </Suspense>
    </AppShell>
  );
}
