import { connection } from "next/server";
import { ChatUnreadSync } from "@/features/chat/unread";
import { NotificationsLive } from "@/features/notifications/components/notifications-live";
import { scopeOf } from "@/features/notifications/schemas";
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
  const context = session.activeContextId ?? undefined;
  const live = (
    <>
      <NotificationsLive scope={scopeOf(session)} />
      {role === "dukandar" ? <ChatUnreadSync shopId={context} /> : null}
      {role === "distributor" ? <ChatUnreadSync orgId={context} /> : null}
    </>
  );
  if (desktopFirst)
    return (
      <>
        <TopBar session={session} groups={groups} />
        {live}
      </>
    );
  return (
    <>
      {live}
      <MobileHeader session={session} className={groups.length ? "lg:hidden" : undefined} />
      {groups.length ? (
        <TopBar session={session} groups={groups} className="hidden lg:flex" />
      ) : null}
    </>
  );
}

export { ShellHeader };
