import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const sb = await getSupabaseServerClient();
  const { data: projects } = await sb
    .from("projects")
    .select("id, project_name, status, updated_at, created_at")
    .order("updated_at", { ascending: false });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">My Projects</h1>
        <Link href="/new" className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-surface">
          New project
        </Link>
      </header>

      <div className="overflow-hidden rounded-2xl bg-surface shadow-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-5 py-3">Project</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Updated</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(projects ?? []).length === 0 && (
              <tr><td className="px-5 py-10 text-center text-ink-muted" colSpan={4}>No projects yet.</td></tr>
            )}
            {(projects ?? []).map((p) => (
              <tr key={p.id}>
                <td className="px-5 py-4 font-medium">{p.project_name}</td>
                <td className="px-5 py-4 text-ink-muted">{p.status.replace(/_/g, " ").toLowerCase()}</td>
                <td className="px-5 py-4 tabular text-ink-muted">{formatDate(p.updated_at)}</td>
                <td className="px-5 py-4 text-right">
                  <Link href={`/projects/${p.id}`} className="text-accent hover:underline">Open</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
