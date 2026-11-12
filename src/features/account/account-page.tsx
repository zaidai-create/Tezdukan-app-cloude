import { connection } from "next/server";
import { Suspense } from "react";
import { ListRowSkeleton } from "@/components/states/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyApplications } from "@/features/onboarding/data";
import { requireSession } from "@/lib/auth/session";
import { AccountView } from "./account-view";

function AccountSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-8" aria-hidden>
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="size-24 rounded-full" />
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
      <div className="rounded-lg border border-border bg-surface px-4">
        <ListRowSkeleton />
        <ListRowSkeleton />
        <ListRowSkeleton />
      </div>
    </div>
  );
}

async function AccountContent() {
  await connection();
  const session = await requireSession();
  // A failed read only hides the application card; the account page itself must open.
  const applications = await getMyApplications().catch(() => []);
  return <AccountView session={session} applications={applications} />;
}

/** Mounted under each role's own path so the role's navigation stays around it. */
export function AccountPage() {
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <AccountContent />
    </Suspense>
  );
}
