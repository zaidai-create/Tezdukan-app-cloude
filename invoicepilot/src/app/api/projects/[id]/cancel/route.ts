import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const sb = await getSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: project } = await sb
    .from("projects")
    .select("id, user_id, status")
    .eq("id", projectId)
    .single();
  if (!project || project.user_id !== user.id) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (project.status === "COMPLETED") return NextResponse.json({ error: "already completed" }, { status: 400 });

  await sb.from("projects").update({ status: "CANCELLED" }).eq("id", projectId);
  await sb.from("messages").insert({
    project_id: projectId,
    role: "assistant",
    content: "Project cancelled. No documents were modified.",
  });
  return NextResponse.json({ ok: true });
}
