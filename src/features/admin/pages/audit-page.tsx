import { History } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { ListRowSkeleton } from "@/components/states/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { AdminHeader, AdminPageShell, ListCard } from "../components/admin-ui";
import { getAudit } from "../data";

const knownActions = [
  "shop.approved",
  "shop.rejected",
  "shop.suspended",
  "shop.reactivated",
  "organization.approved",
  "organization.rejected",
  "organization.suspended",
  "organization.reactivated",
  "feature_flags.update",
] as const;
type KnownAction = (typeof knownActions)[number];
const isKnown = (action: string): action is KnownAction =>
  (knownActions as readonly string[]).includes(action);

/** A short "before → after" for the fields that changed. */
function changes(before: unknown, after: unknown): string | null {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return null;
  const from = before as Record<string, unknown>;
  const to = after as Record<string, unknown>;
  const keys = Object.keys(to).filter(
    (key) =>
      !["created_at", "created_by"].includes(key) &&
      JSON.stringify(from[key]) !== JSON.stringify(to[key]),
  );
  if (keys.length === 0) return null;
  return keys
    .slice(0, 4)
    .map(
      (key) => `${key}: ${JSON.stringify(from[key] ?? null)} → ${JSON.stringify(to[key] ?? null)}`,
    )
    .join(", ");
}

async function AuditContent() {
  await connection();
  await requireRole("admin", "/admin/audit");
  const [t, entries] = await Promise.all([getTranslations("admin"), getAudit()]);
  return (
    <AdminPageShell>
      <AdminHeader title={t("audit.title")} subtitle={t("audit.subtitle")} />
      {entries.length === 0 ? (
        <EmptyState icon={History} title={t("audit.empty")} />
      ) : (
        <ListCard label={t("audit.title")}>
          {entries.map((entry) => {
            const detail = changes(entry.before, entry.after);
            return (
              <li key={entry.id} className="flex flex-col gap-0.5 px-4 py-3">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-semibold text-ink">
                    {isKnown(entry.action) ? t(`audit.actions.${entry.action}`) : entry.action}
                    {entry.shop_name || entry.org_name ? (
                      <span className="font-normal text-muted">
                        {" · "}
                        {entry.shop_name ?? entry.org_name}
                      </span>
                    ) : null}
                  </span>
                  <span className="num text-xs text-muted">{formatDateTime(entry.created_at)}</span>
                </span>
                <span className="text-sm text-muted">
                  {t("audit.by", { name: entry.actor_name ?? t("audit.system") })}
                </span>
                {detail ? (
                  <span dir="ltr" className="num text-xs break-all text-ink/70">
                    {detail}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ListCard>
      )}
    </AdminPageShell>
  );
}

/** Who changed what, newest first. */
export function AdminAuditPage() {
  return (
    <Suspense
      fallback={
        <AdminPageShell>
          <Skeleton className="h-10 w-40 rounded-md" />
          <div className="rounded-lg border border-border bg-surface px-4">
            <ListRowSkeleton />
            <ListRowSkeleton />
          </div>
        </AdminPageShell>
      }
    >
      <AuditContent />
    </Suspense>
  );
}
