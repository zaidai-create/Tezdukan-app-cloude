import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { roleIcon } from "@/components/layout/nav-config";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { isMemberRole, roleHome, type AppRole } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { activeContextOf } from "@/lib/auth/session-types";

function RoleHomeSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6" aria-hidden>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}

async function RoleHomeContent({ role }: { role: AppRole }) {
  await connection();
  const session = await requireRole(role, roleHome[role]);
  const t = await getTranslations();
  const context = activeContextOf(session);
  const Icon = roleIcon[role];
  const firstName = session.fullName.split(" ")[0] ?? "";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 lg:px-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink lg:text-3xl">
          {firstName ? t("home.greetingNamed", { name: firstName }) : t("home.greeting")}
        </h1>
        <p className="mt-1 text-base text-muted">{t(`home.subtitle.${role}`)}</p>
      </div>

      {context?.name ? (
        <Card className="flex items-center gap-4 p-4">
          <Avatar className="size-14 rounded-lg">
            {context.imageUrl ? <AvatarImage src={context.imageUrl} alt="" /> : null}
            <AvatarFallback name={context.name} className="rounded-lg text-base" />
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-lg font-semibold text-ink">{context.name}</p>
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <Icon aria-hidden className="size-4" />
              {t(`roles.${role}`)}
              {isMemberRole(context.memberRole) ? ` · ${t(`members.${context.memberRole}`)}` : null}
            </p>
          </div>
          {context.status === "approved" ? (
            <StatusBadge tone="success">{t("home.statusActive")}</StatusBadge>
          ) : (
            <StatusBadge tone="warning">{t("roles.awaitingApproval")}</StatusBadge>
          )}
        </Card>
      ) : null}
    </div>
  );
}

/** Role landing page. Each role's full home replaces the body as its phase ships. */
export function RoleHome({ role }: { role: AppRole }) {
  return (
    <Suspense fallback={<RoleHomeSkeleton />}>
      <RoleHomeContent role={role} />
    </Suspense>
  );
}
