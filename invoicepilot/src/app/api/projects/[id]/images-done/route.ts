import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { canTransition } from "@/lib/state/machine";

// User signals "that's all the images" — moves the workflow from
// WAITING_FOR_IMAGES to IMAGES_RECEIVED (then COLLECTING_CHANGES).
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

  const { count: imageCount } = await sb
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("document_type", "image");
  if (!imageCount) return NextResponse.json({ error: "Upload at least one image first." }, { status: 400 });

  if (project.status !== "WAITING_FOR_IMAGES") {
    return NextResponse.json({ error: `Cannot mark images done from ${project.status}` }, { status: 400 });
  }
  if (!canTransition("WAITING_FOR_IMAGES", "IMAGES_RECEIVED")) {
    return NextResponse.json({ error: "Illegal transition" }, { status: 400 });
  }

  await sb.from("projects").update({ status: "COLLECTING_CHANGES" }).eq("id", projectId);
  await sb.from("messages").insert({
    project_id: projectId,
    role: "assistant",
    content: "I've received your PDF and all invoice images. Now please tell me the changes you want.",
  });

  return NextResponse.json({ status: "COLLECTING_CHANGES" });
}
