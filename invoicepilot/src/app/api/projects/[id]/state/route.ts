import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const sb = await getSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: project } = await sb.from("projects").select("*").eq("id", projectId).single();
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [{ data: documents }, { data: messages }, { data: plan }, { data: job }] = await Promise.all([
    sb.from("documents").select("*").eq("project_id", projectId).order("created_at"),
    sb.from("messages").select("*").eq("project_id", projectId).order("created_at"),
    sb.from("change_plans").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("processing_jobs").select("id, status, output_path, quality_report, created_at, completed_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return NextResponse.json({ project, documents: documents ?? [], messages: messages ?? [], plan, job });
}
