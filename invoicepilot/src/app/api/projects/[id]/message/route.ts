import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { runAgent } from "@/lib/openai/agent";
import { PostMessageInput } from "@/lib/schemas";
import { canTransition } from "@/lib/state/machine";
import type { Message, ProjectStatus } from "@/lib/supabase/types";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const sb = await getSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = PostMessageInput.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: body.error.message }, { status: 400 });

  const { data: project } = await sb
    .from("projects")
    .select("id, status, user_id")
    .eq("id", projectId)
    .single();
  if (!project || project.user_id !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Persist the user message.
  await sb.from("messages").insert({
    project_id: projectId, role: "user", content: body.data.content,
  });

  // Gather context.
  const [{ data: convo }, { data: docs }, { data: invoices }] = await Promise.all([
    sb.from("messages").select("role, content").eq("project_id", projectId).order("created_at").returns<Pick<Message, "role" | "content">[]>(),
    sb.from("documents").select("original_filename, document_type, page_count").eq("project_id", projectId).order("created_at"),
    sb.from("invoices").select("invoice_number, source_page, extracted_data").eq("project_id", projectId).order("created_at"),
  ]);

  const pdfs = (docs ?? [])
    .filter((d) => d.document_type === "pdf")
    .map((d) => ({ filename: d.original_filename, page_count: d.page_count ?? null }));
  const images = (docs ?? [])
    .filter((d) => d.document_type === "image")
    .map((d, i) => ({ index: i, filename: d.original_filename }));
  const invoiceCtx = (invoices ?? []).map((inv, i) => ({
    label: `Invoice ${i + 1}`,
    invoice_number: inv.invoice_number,
    source_page: inv.source_page,
    data: inv.extracted_data,
  }));

  const history = (convo ?? []).slice(-24);
  const reply = await runAgent({
    status: project.status as ProjectStatus,
    pdfs,
    images,
    invoices: invoiceCtx,
    conversation: history.slice(0, -1), // the latest user message is added below by runAgent
    user_message: body.data.content,
  });

  // Validate proposed state transition.
  let nextStatus = project.status as ProjectStatus;
  if (reply.next_status && reply.next_status !== project.status && canTransition(nextStatus, reply.next_status)) {
    // Server-side guards override whatever the model proposes:
    //  - Never let the model jump into PROCESSING/QUALITY_CHECK/COMPLETED.
    //  - Require an explicit plan to reach CHANGE_SUMMARY.
    //  - APPROVED is only set by /approve (ignore here).
    const forbidden: ProjectStatus[] = ["PROCESSING", "QUALITY_CHECK", "COMPLETED", "APPROVED"];
    if (!forbidden.includes(reply.next_status)) {
      if (reply.next_status === "CHANGE_SUMMARY" && !reply.plan) {
        // Keep as COLLECTING_CHANGES until a structured plan is provided.
        nextStatus = "COLLECTING_CHANGES";
      } else {
        nextStatus = reply.next_status;
      }
    }
  }
  if (nextStatus !== project.status) {
    await sb.from("projects").update({ status: nextStatus }).eq("id", projectId);
  }

  // If the model produced a plan, persist it as awaiting_approval.
  let planId: string | null = null;
  if (reply.plan) {
    const ins = await sb
      .from("change_plans")
      .insert({
        project_id: projectId,
        changes_json: reply.plan,
        status: "awaiting_approval",
      })
      .select("id")
      .single();
    planId = ins.data?.id ?? null;
  }

  await sb.from("messages").insert({
    project_id: projectId,
    role: "assistant",
    content: reply.message,
    metadata: { plan_id: planId, ask: reply.ask ?? null },
  });

  return NextResponse.json({ status: nextStatus, planId, message: reply.message });
}
