import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function Landing() {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/projects");

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-ink text-surface grid place-items-center font-semibold">IP</div>
        <span className="text-lg font-semibold tracking-tight">InvoicePilot AI</span>
      </div>
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">Process invoice documents with AI, under your control.</h1>
        <p className="text-ink-muted">Upload a PDF and invoice images. Describe the changes you need in plain language. Approve the summary, and we generate a clean, verified output PDF.</p>
      </div>
      <Link href="/signin" className="inline-flex items-center justify-center rounded-xl bg-ink px-5 py-3 text-sm font-medium text-surface hover:opacity-90 transition">Sign in to continue</Link>
    </main>
  );
}
