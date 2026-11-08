import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { extractPdfPages, pdfTextProbe } from "@/lib/pdf/engine";
import { analyzeInvoiceImage } from "@/lib/openai/agent";
import { canTransition } from "@/lib/state/machine";

const MAX_PDF = 25 * 1024 * 1024;
const MAX_IMAGE = 15 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const sb = await getSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: project } = await sb
    .from("projects")
    .select("id, status, user_id")
    .eq("id", projectId)
    .single();
  if (!project || project.user_id !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "missing file" }, { status: 400 });

  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isImage = ALLOWED_IMAGE_MIME.has(file.type);
  if (!isPdf && !isImage) return NextResponse.json({ error: "unsupported file type" }, { status: 400 });
  if (isPdf && file.size > MAX_PDF) return NextResponse.json({ error: "PDF too large (max 25MB)" }, { status: 400 });
  if (isImage && file.size > MAX_IMAGE) return NextResponse.json({ error: "Image too large (max 15MB)" }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const path = `${user.id}/${projectId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error: upErr } = await sb.storage
    .from("originals")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  let pageCount: number | null = null;
  const extracted: { invoice_number?: string; raw_text?: string; confidence: number } = { confidence: 0 };

  if (isPdf) {
    try {
      const info = await extractPdfPages(bytes);
      pageCount = info.pageCount;
      await pdfTextProbe(bytes);
    } catch { /* leave pageCount null */ }
  }

  const { data: doc, error: docErr } = await sb
    .from("documents")
    .insert({
      project_id: projectId,
      original_filename: file.name,
      storage_path: path,
      document_type: isPdf ? "pdf" : "image",
      mime_type: file.type || (isPdf ? "application/pdf" : "image/jpeg"),
      size_bytes: file.size,
      page_count: pageCount,
    })
    .select("id")
    .single();
  if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 });

  // For images, run OCR/vision in-line. Failure is non-fatal.
  if (isImage) {
    try {
      const b64 = Buffer.from(bytes).toString("base64");
      const dataUrl = `data:${file.type};base64,${b64}`;
      const vision = await analyzeInvoiceImage(dataUrl);
      Object.assign(extracted, vision);
      await sb.from("invoices").insert({
        project_id: projectId,
        document_id: doc.id,
        invoice_number: vision.invoice_number ?? null,
        source_page: null,
        extracted_data: vision as unknown as Record<string, unknown>,
        confidence: vision.confidence,
      });
    } catch { /* ignore vision errors */ }
  }

  // Advance workflow state deterministically.
  const current = project.status as
    | "WAITING_FOR_PDF" | "PDF_RECEIVED" | "WAITING_FOR_IMAGES" | "IMAGES_RECEIVED";
  let nextStatus = current;
  if (isPdf && current === "WAITING_FOR_PDF" && canTransition(current, "PDF_RECEIVED")) {
    nextStatus = "PDF_RECEIVED";
  } else if (isImage && (current === "PDF_RECEIVED" || current === "WAITING_FOR_IMAGES")) {
    nextStatus = current === "PDF_RECEIVED" ? (canTransition(current, "WAITING_FOR_IMAGES") ? "WAITING_FOR_IMAGES" : current) : current;
  }

  if (nextStatus !== current) {
    await sb.from("projects").update({ status: nextStatus }).eq("id", projectId);
    const openingMsg = isPdf
      ? "I've received your PDF. Now please share all the invoice images one by one."
      : "Got it. Keep sending images, and let me know when you've uploaded them all.";
    await sb.from("messages").insert({ project_id: projectId, role: "assistant", content: openingMsg });
  }

  return NextResponse.json({ id: doc.id, pageCount, extracted, status: nextStatus });
}

function safeName(s: string) {
  return s.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120);
}
