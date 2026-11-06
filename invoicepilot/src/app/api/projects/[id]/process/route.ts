import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ChangePlan, type ChangePlanT } from "@/lib/schemas";
import { applyApprovedAnnotations, validateFinalPdf } from "@/lib/pdf/engine";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const sb = await getSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: project } = await sb
    .from("projects")
    .select("id, status, user_id")
    .eq("id", projectId)
    .single();
  if (!project || project.user_id !== user.id) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (project.status !== "APPROVED") {
    return NextResponse.json({ error: `Project is ${project.status}; not in APPROVED state.` }, { status: 400 });
  }

  // Latest approved plan.
  const { data: plan } = await sb
    .from("change_plans")
    .select("id, changes_json, status")
    .eq("project_id", projectId)
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(1)
    .single();
  if (!plan) return NextResponse.json({ error: "no approved plan" }, { status: 400 });

  const parsed = ChangePlan.safeParse(plan.changes_json);
  if (!parsed.success) return NextResponse.json({ error: "plan validation failed" }, { status: 400 });
  const planData: ChangePlanT = parsed.data;

  // Create job + move to PROCESSING.
  const { data: job } = await sb
    .from("processing_jobs")
    .insert({ project_id: projectId, change_plan_id: plan.id, status: "running" })
    .select("id")
    .single();
  if (!job) return NextResponse.json({ error: "could not start job" }, { status: 500 });

  await sb.from("projects").update({ status: "PROCESSING" }).eq("id", projectId);

  try {
    // Load the primary PDF (latest uploaded pdf for the project).
    const { data: pdfDoc } = await sb
      .from("documents")
      .select("storage_path, original_filename")
      .eq("project_id", projectId)
      .eq("document_type", "pdf")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!pdfDoc) throw new Error("No PDF uploaded for this project.");

    const [{ data: pdfBlob }, { data: images }] = await Promise.all([
      sb.storage.from("originals").download(pdfDoc.storage_path),
      sb.from("documents")
        .select("storage_path, mime_type, original_filename")
        .eq("project_id", projectId)
        .eq("document_type", "image")
        .order("created_at"),
    ]);
    if (!pdfBlob) throw new Error("Could not download PDF.");

    const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());

    // Pull image bytes.
    const imageAttachments: { bytes: Uint8Array; mime: string }[] = [];
    for (const img of images ?? []) {
      const { data } = await sb.storage.from("originals").download(img.storage_path);
      if (!data) continue;
      imageAttachments.push({ bytes: new Uint8Array(await data.arrayBuffer()), mime: img.mime_type });
    }

    // Map plan to pages. First invoice → page 1, etc., unless the plan
    // specifies source_page explicitly.
    const changesByPage = new Map<number, ChangePlanT["invoices"][number]["changes"]>();
    planData.invoices.forEach((inv, i) => {
      const page = inv.changes.target.source_page ?? i + 1;
      changesByPage.set(page, inv.changes);
    });

    const outBytes = await applyApprovedAnnotations({ pdfBytes, imageAttachments, changesByPage });

    // QUALITY_CHECK.
    await sb.from("projects").update({ status: "QUALITY_CHECK" }).eq("id", projectId);
    const minPages = (await (async () => {
      try {
        const { extractPdfPages } = await import("@/lib/pdf/engine");
        const { pageCount } = await extractPdfPages(pdfBytes);
        return pageCount;
      } catch { return 1; }
    })());
    const qc = await validateFinalPdf(outBytes, minPages);

    if (!qc.ok) {
      await sb.from("processing_jobs").update({
        status: "failed",
        error: qc.issues.join("; "),
        quality_report: qc,
      }).eq("id", job.id);
      await sb.from("projects").update({ status: "APPROVED" }).eq("id", projectId); // allow retry
      return NextResponse.json({ error: "Quality check failed", issues: qc.issues }, { status: 422 });
    }

    // Upload output to the 'outputs' bucket (user-scoped by path).
    const outPath = `${user.id}/${projectId}/${job.id}.pdf`;
    const { error: upErr } = await sb.storage
      .from("outputs")
      .upload(outPath, outBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error("Could not save output: " + upErr.message);

    await sb.from("processing_jobs").update({
      status: "succeeded",
      output_path: outPath,
      quality_report: qc,
      completed_at: new Date().toISOString(),
    }).eq("id", job.id);

    await sb.from("projects").update({ status: "COMPLETED" }).eq("id", projectId);
    await sb.from("messages").insert({
      project_id: projectId,
      role: "assistant",
      content: `Done. The revised PDF is ready — ${qc.pageCount} page(s). You can preview and download it.`,
      metadata: { job_id: job.id },
    });

    return NextResponse.json({ ok: true, jobId: job.id, pageCount: qc.pageCount });
  } catch (err) {
    await sb.from("processing_jobs").update({
      status: "failed",
      error: (err as Error).message,
    }).eq("id", job.id);
    await sb.from("projects").update({ status: "APPROVED" }).eq("id", projectId);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
