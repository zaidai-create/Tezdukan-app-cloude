import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; docId: string }> }) {
  const { id: projectId, docId } = await ctx.params;
  const sb = await getSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: doc } = await sb
    .from("documents")
    .select("storage_path, mime_type, project_id")
    .eq("id", docId)
    .eq("project_id", projectId)
    .single();
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: blob } = await sb.storage.from("originals").download(doc.storage_path);
  if (!blob) return NextResponse.json({ error: "no file" }, { status: 404 });

  return new NextResponse(blob.stream(), {
    headers: {
      "Content-Type": doc.mime_type,
      "Cache-Control": "private, max-age=600",
    },
  });
}
