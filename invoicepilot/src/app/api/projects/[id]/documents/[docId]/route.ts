import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; docId: string }> }) {
  const { id: projectId, docId } = await ctx.params;
  const sb = await getSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: doc } = await sb
    .from("documents")
    .select("id, project_id, storage_path, document_type")
    .eq("id", docId)
    .eq("project_id", projectId)
    .single();
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  await sb.storage.from("originals").remove([doc.storage_path]);
  await sb.from("documents").delete().eq("id", docId);

  // If no PDFs remain, roll status back to WAITING_FOR_PDF.
  const { count: pdfCount } = await sb
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("document_type", "pdf");
  if ((pdfCount ?? 0) === 0) {
    await sb.from("projects").update({ status: "WAITING_FOR_PDF" }).eq("id", projectId);
  }

  return NextResponse.json({ ok: true });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; docId: string }> }) {
  const { id: projectId, docId } = await ctx.params;
  const sb = await getSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: doc } = await sb
    .from("documents")
    .select("id, project_id, storage_path, mime_type, original_filename")
    .eq("id", docId)
    .eq("project_id", projectId)
    .single();
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: signed } = await sb.storage
    .from("originals")
    .createSignedUrl(doc.storage_path, 60 * 10);

  return NextResponse.json({
    id: doc.id,
    filename: doc.original_filename,
    mime: doc.mime_type,
    url: signed?.signedUrl ?? null,
  });
}
