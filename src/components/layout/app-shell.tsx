import { cn } from "cn";
import { getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { MunshiFab } from "@/components/munshi/munshi-fab";
import { MunshiSheet } from "@/components/munshi/munshi-sheet";
import { AppUpdatePrompt } from "@/components/pwa/app-update-prompt";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { ServerOnlyScript } from "@/components/server-only-script";
import { OfflineBanner } from "@/components/states/offline-banner";
import { launchAdBootScript } from "@/features/launch-ad/boot";
import { LaunchAd } from "@/features/launch-ad/launch-ad";
import type { AppRole } from "@/lib/auth/roles";
import { getShellSession } from "@/lib/auth/session";
import { BottomNav, BottomNavView } from "./bottom-nav";
import { MobileHeaderSkeleton } from "./mobile-header";
import { mobileTabs, sidebarGroups } from "./nav-config";
import { ShellHeader } from "./shell-header";
import { Sidebar } from "./sidebar";

/**
 * One shell for every role. Mobile-first roles get a bottom nav (and a sidebar on large
 * screens if they have one); desktop-first roles get the sidebar + top bar, with a menu
 * sheet on phones. The chrome is static and prerendered; only the header (who you are)
 * streams in, behind a skeleton.
 */
async function AppShell({ role, children }: { role: AppRole; children: ReactNode }) {
  const t = await getTranslations("common");
  const tabs = mobileTabs[role];
  const groups = sidebarGroups[role];
  const desktopFirst = !tabs;

  return (
    <div className="flex min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-action px-4 py-3 text-on-action focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t("skipToContent")}
      </a>
      {groups ? <Sidebar groups={groups} /> : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <Suspense fallback={<MobileHeaderSkeleton />}>
          <ShellHeader role={role} desktopFirst={desktopFirst} />
        </Suspense>
        <main
          id="main"
          className={cn(
            "flex-1",
            tabs ? "pb-[calc(var(--bottom-nav-space)+24px)] lg:pb-10" : "pb-24",
          )}
        >
          {children}
        </main>
      </div>
      {tabs ? (
        // The lit tab depends on the path, which is request data on dynamic routes.
        <Suspense
          fallback={
            <BottomNavView
              items={tabs}
              pathname={null}
              className={groups ? "lg:hidden" : undefined}
            />
          }
        >
          <BottomNav items={tabs} className={groups ? "lg:hidden" : undefined} />
        </Suspense>
      ) : null}
      <MunshiFab className={tabs ? (groups ? "hidden lg:flex" : "hidden") : undefined} />
      <Suspense fallback={null}>
        <TezSheet role={role} />
      </Suspense>
      <InstallPrompt />
      <AppUpdatePrompt />
      {role === "admin" ? null : (
        <>
          <ServerOnlyScript code={launchAdBootScript} />
          <LaunchAd variant={role === "customer" ? "customer" : "business"} />
        </>
      )}
    </div>
  );
}

/** Tez greets by first name, which is request data: it streams in behind the shell. */
async function TezSheet({ role }: { role: AppRole }) {
  const session = await getShellSession();
  const firstName = session?.fullName.trim().split(/\s+/)[0] ?? "";
  return <MunshiSheet role={role} name={firstName} />;
}

export { AppShell };
