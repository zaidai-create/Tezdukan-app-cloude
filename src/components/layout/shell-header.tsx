import { connection } from "next/server";
import { roleHome, type AppRole } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { MobileHeader } from "./mobile-header";
import { sidebarGroups } from "./nav-config";
import { TopBar } from "./top-bar";

/** Reads the session (request-time), so it always renders inside a Suspense boundary. */
async function ShellHeader({ role, desktopFirst }: { role: AppRole; desktopFirst: boolean }) {
  await connection();
  const session = await requireRole(role, roleHome[role]);
  const groups = sidebarGroups[role] ?? [];
  if (desktopFirst) return <TopBar session={session} groups={groups} />;
  return (
    <>
      <MobileHeader session={session} className={groups.length ? "lg:hidden" : undefined} />
      {groups.length ? (
        <TopBar session={session} groups={groups} className="hidden lg:flex" />
      ) : null}
    </>
  );
}

export { ShellHeader };
