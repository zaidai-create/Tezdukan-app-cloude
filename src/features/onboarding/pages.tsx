import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireSession } from "@/lib/auth/session";
import { RegisterForm } from "./components/register-form";
import { getServiceAreas } from "./data";

function RegisterSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-5" aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <Skeleton className="h-8 w-56" />
      </div>
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  );
}

async function RegisterContent({ kind }: { kind: "dukan" | "distributor" }) {
  await connection();
  const [session, areas] = await Promise.all([requireSession(), getServiceAreas()]);
  return <RegisterForm kind={kind} areas={areas} phone={session.phone} />;
}

export function RegisterPage({ kind }: { kind: "dukan" | "distributor" }) {
  return (
    <main className="min-h-dvh bg-canvas">
      <Suspense fallback={<RegisterSkeleton />}>
        <RegisterContent kind={kind} />
      </Suspense>
    </main>
  );
}
