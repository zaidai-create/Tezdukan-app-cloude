import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const sb = await getSupabaseServerClient();
  const { data: jobs } = await sb
    .from("processing_jobs")
    .select("id, project_id, status, output_path, created_at, completed_at")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Document History</h1>
      <p className="mt-1 text-sm text-ink-muted">Every output generated across your projects.</p>

      <div className="mt-6 overflow-hidden rounded-2xl bg-surface shadow-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-5 py-3">Project</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Generated</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(jobs ?? []).length === 0 && (
              <tr><td className="px-5 py-10 text-center text-ink-muted" colSpan={4}>No generated documents yet.</td></tr>
            )}
            {(jobs ?? []).map((j) => (
              <tr key={j.id}>
                <td className="px-5 py-4">
                  <Link href={`/projects/${j.project_id}`} className="text-accent hover:underline">
                    Open project
                  </Link>
                </td>
                <td className="px-5 py-4">{j.status}</td>
                <td className="px-5 py-4 tabular">{j.completed_at ? formatDateTime(j.completed_at) : "—"}</td>
                <td className="px-5 py-4 text-right">
                  {j.status === "succeeded" && (
                    <a href={`/api/jobs/${j.id}/download`} className="text-accent hover:underline">Download</a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
