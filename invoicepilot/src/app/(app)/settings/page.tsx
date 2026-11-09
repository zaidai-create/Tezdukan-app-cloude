import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const sb = await getSupabaseServerClient();
  const { data } = await sb.auth.getUser();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <section className="mt-6 rounded-2xl bg-surface p-5 shadow-card">
        <h2 className="text-sm font-medium text-ink-muted">Account</h2>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <div className="font-medium">{data.user?.email}</div>
            <div className="text-xs text-ink-muted">Signed in</div>
          </div>
        </div>
      </section>
      <section className="mt-4 rounded-2xl bg-surface p-5 shadow-card">
        <h2 className="text-sm font-medium text-ink-muted">AI model</h2>
        <p className="mt-1 text-sm">
          Document understanding runs on the server. The provider is set with
          <code className="mx-1 rounded bg-surface-panel px-1 py-0.5 text-xs">AI_PROVIDER</code>
          (<code className="rounded bg-surface-panel px-1 py-0.5 text-xs">gemini</code> or
          <code className="mx-1 rounded bg-surface-panel px-1 py-0.5 text-xs">openai</code>) and the model with
          <code className="mx-1 rounded bg-surface-panel px-1 py-0.5 text-xs">GEMINI_MODEL</code> /
          <code className="mx-1 rounded bg-surface-panel px-1 py-0.5 text-xs">OPENAI_MODEL</code>.
        </p>
      </section>
    </div>
  );
}
