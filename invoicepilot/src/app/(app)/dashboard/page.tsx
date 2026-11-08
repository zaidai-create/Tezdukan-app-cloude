import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const sb = await getSupabaseServerClient();
  const { data: projects } = await sb
    .from("projects")
    .select("id, project_name, status, updated_at")
    .order("updated_at", { ascending: false })
    .limit(5);

  const completed = (projects ?? []).filter((p) => p.status === "COMPLETED").length;
  const inProgress = (projects ?? []).filter((p) => p.status !== "COMPLETED" && p.status !== "CANCELLED").length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-ink-muted">Your invoice processing workspace.</p>
        </div>
        <Link href="/new" className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-surface">
          New project
        </Link>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="In progress" value={inProgress} />
        <Stat label="Completed" value={completed} />
        <Stat label="Total" value={projects?.length ?? 0} />
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-medium text-ink-muted">Recent projects</h2>
        <ul className="divide-y divide-line rounded-2xl bg-surface shadow-card">
          {(projects ?? []).length === 0 && (
            <li className="p-6 text-sm text-ink-muted">No projects yet. Create one to start.</li>
          )}
          {(projects ?? []).map((p) => (
            <li key={p.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <Link href={`/projects/${p.id}`} className="font-medium text-ink hover:underline">
                  {p.project_name}
                </Link>
                <div className="text-xs text-ink-muted">{p.status.replace(/_/g, " ").toLowerCase()}</div>
              </div>
              <Link href={`/projects/${p.id}`} className="text-sm text-accent hover:underline">
                Open
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-card">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="mt-2 text-3xl font-semibold tabular">{value}</div>
    </div>
  );
}
