import { Megaphone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/session";
import { AdminHeader, AdminPageShell, ListCard } from "../components/admin-ui";
import { BroadcastForm } from "../components/broadcast-form";
import { TimeAgo } from "../components/time-ago";
import { getBroadcasts } from "../data";

async function BroadcastContent() {
  await connection();
  await requireRole("admin", "/admin/broadcast");
  const [t, history] = await Promise.all([getTranslations("admin.broadcast"), getBroadcasts()]);
  return (
    <AdminPageShell>
      <AdminHeader title={t("title")} subtitle={t("subtitle")} />
      <BroadcastForm />
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-bold text-ink">{t("history")}</h2>
        {history.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={t("historyEmpty")}
            description={t("historyEmptyHint")}
          />
        ) : (
          <ListCard label={t("history")}>
            {history.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-strong">
                  <Megaphone aria-hidden className="size-5" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-semibold text-ink">{item.title}</span>
                    <span className="shrink-0 text-xs text-muted">
                      <TimeAgo value={item.created_at} />
                    </span>
                  </span>
                  <span className="line-clamp-2 block text-sm text-ink/80">{item.body}</span>
                  <span className="num block text-xs text-muted">
                    {t("historyLine", {
                      audience: t(`audience.${item.audience}`),
                      sent: item.sent_count,
                      push: item.push_count,
                    })}
                  </span>
                </span>
              </li>
            ))}
          </ListCard>
        )}
      </section>
    </AdminPageShell>
  );
}

function BroadcastSkeleton() {
  return (
    <AdminPageShell>
      <Skeleton className="h-10 w-64 rounded-md" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-[480px] rounded-lg" />
        <Skeleton className="h-28 rounded-[22px]" />
      </div>
    </AdminPageShell>
  );
}

/** Send a notification to customers, dukandars, distributors, everyone or one person. */
export function AdminBroadcastPage() {
  return (
    <Suspense fallback={<BroadcastSkeleton />}>
      <BroadcastContent />
    </Suspense>
  );
}
