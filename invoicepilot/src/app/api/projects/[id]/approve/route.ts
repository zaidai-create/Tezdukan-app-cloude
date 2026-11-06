import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { canTransition } from "@/lib/state/machine";
import { ChangePlan } from "@/lib/schemas";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const sb = await getSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { planId } = await req.json().catch(() => ({ planId: null }));
  if (!planId) return NextResponse.json({ error: "planId required" }, { status: 400 });

  const { data: project } = await sb
    .from("projects")
    .select("id, status, user_id")
    .eq("id", projectId)
    .single();
  if (!project || project.user_id !== user.id) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (project.status !== "CHANGE_SUMMARY") {
    return NextResponse.json({ error: `Cannot approve from ${project.status}` }, { status: 400 });
  }

  const { data: plan } = await sb
    .from("change_plans")
    .select("id, project_id, changes_json, status")
    .eq("id", planId)
    .eq("project_id", projectId)
    .single();
  if (!plan) return NextResponse.json({ error: "plan not found" }, { status: 404 });

  // Re-validate the plan server-side before approving.
  const parsed = ChangePlan.safeParse(plan.changes_json);
  if (!parsed.success) return NextResponse.json({ error: "plan validation failed" }, { status: 400 });

  if (!canTransition("CHANGE_SUMMARY", "APPROVED")) {
    return NextResponse.json({ error: "illegal transition" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  await sb.from("change_plans").update({ status: "approved", approved_at: nowIso }).eq("id", planId);
  await sb.from("projects").update({ status: "APPROVED" }).eq("id", projectId);
  await sb.from("messages").insert({
    project_id: projectId,
    role: "assistant",
    content: "Confirmed. I will now prepare the revised document according to the approved instructions.",
    metadata: { plan_id: planId, approved_at: nowIso },
  });

  return NextResponse.json({ ok: true });
}
