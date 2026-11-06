import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const sb = await getSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: job } = await sb
    .from("processing_jobs")
    .select("id, project_id, output_path, status")
    .eq("id", jobId)
    .single();
  if (!job || !job.output_path || job.status !== "succeeded") {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }

  // RLS ensures the project belongs to this user. Issue a signed URL and redirect.
  const { data: signed } = await sb.storage.from("outputs").createSignedUrl(job.output_path, 120);
  if (!signed) return NextResponse.json({ error: "could not sign url" }, { status: 500 });

  return NextResponse.redirect(signed.signedUrl, { status: 302 });
}
