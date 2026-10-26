import { connection } from "next/server";
import { Suspense } from "react";
import { ListRowSkeleton } from "@/components/states/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { requireSession } from "@/lib/auth/session";
import { AccountView } from "./account-view";

function AccountSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6" aria-hidden>
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      <div className="rounded-lg border border-border bg-surface px-4">
        <ListRowSkeleton />
        <ListRowSkeleton />
      </div>
      <Skeleton className="h-28 w-full rounded-lg" />
    </div>
  );
}

async function AccountContent() {
  await connection();
  const session = await requireSession();
  return <AccountView session={session} />;
}

/** Mounted under each role's own path so the role's navigation stays around it. */
export function AccountPage() {
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <AccountContent />
    </Suspense>
  );
}
