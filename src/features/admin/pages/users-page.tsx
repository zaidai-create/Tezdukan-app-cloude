import { MessageSquareShare, Phone, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { ListRowSkeleton } from "@/components/states/skeletons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/session";
import { telHref, whatsappHref } from "@/lib/contact";
import { formatDate } from "@/lib/format";
import { formatPkMobile } from "@/lib/phone";
import { AdminHeader, AdminPageShell, ListCard } from "../components/admin-ui";
import { SearchBox } from "../components/search-box";
import { getAdminUsers } from "../data";
import { first, type SearchParams } from "./shared";

const chip = "rounded-full px-2 py-0.5 text-xs font-semibold";

async function UsersContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  await requireRole("admin", "/admin/users");
  const params = await searchParams;
  const query = first(params.q) ?? "";
  const [t, users] = await Promise.all([getTranslations("admin"), getAdminUsers(query)]);
  return (
    <AdminPageShell>
      <AdminHeader
        title={t("users.title")}
        subtitle={t("directory.count", { count: users.length })}
      />
      <SearchBox label={t("directory.search")} placeholder={t("users.search")} />
      {users.length === 0 ? (
        <EmptyState icon={Users} title={t("directory.empty")} />
      ) : (
        <ListCard label={t("users.title")}>
          {users.map((user) => {
            const tel = telHref(user.phone);
            const wa = whatsappHref(user.phone);
            return (
              <li key={user.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar className="size-11 shrink-0">
                  <AvatarFallback name={user.full_name || "?"} />
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">
                    {user.full_name || t("users.noName")}
                  </span>
                  <span className="num block truncate text-sm text-muted">
                    {[
                      user.phone ? formatPkMobile(user.phone) : null,
                      t("users.joined", { date: formatDate(user.created_at) }),
                      user.orders > 0 ? t("users.orders", { count: user.orders }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {user.platform_roles.map((role) => (
                      <span key={role} className={`${chip} bg-danger-soft text-danger-ink`}>
                        {t(`users.role.${role}` as "users.role.admin")}
                      </span>
                    ))}
                    {user.shops.map((name) => (
                      <span
                        key={`s-${name}`}
                        className={`${chip} bg-primary-soft text-primary-strong`}
                      >
                        {name}
                      </span>
                    ))}
                    {user.orgs.map((name) => (
                      <span key={`o-${name}`} className={`${chip} bg-awning-soft text-awning-ink`}>
                        {name}
                      </span>
                    ))}
                  </span>
                </span>
                {tel ? (
                  <a
                    href={tel}
                    aria-label={`${t("list.call")}: ${user.full_name}`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong"
                  >
                    <Phone aria-hidden className="size-5" strokeWidth={1.75} />
                  </a>
                ) : null}
                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${t("list.whatsapp")}: ${user.full_name}`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong max-sm:hidden"
                  >
                    <MessageSquareShare aria-hidden className="size-5" strokeWidth={1.75} />
                  </a>
                ) : null}
              </li>
            );
          })}
        </ListCard>
      )}
    </AdminPageShell>
  );
}

/** Everyone on TezDukan: search by name or phone, see their dukans and distributors. */
export function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <AdminPageShell>
          <Skeleton className="h-10 w-40 rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
          <div className="rounded-lg border border-border bg-surface px-4">
            <ListRowSkeleton />
            <ListRowSkeleton />
          </div>
        </AdminPageShell>
      }
    >
      <UsersContent searchParams={searchParams} />
    </Suspense>
  );
}
