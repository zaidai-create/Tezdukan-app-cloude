import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { CreateProjectInput } from "@/lib/schemas";

export async function POST(req: Request) {
  const sb = await getSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = CreateProjectInput.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: body.error.message }, { status: 400 });

  const { data, error } = await sb
    .from("projects")
    .insert({ user_id: user.id, project_name: body.data.project_name })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Seed the opening assistant message so the workflow starts in WAITING_FOR_PDF.
  await sb.from("messages").insert({
    project_id: data.id,
    role: "assistant",
    content: "Please upload your original PDF first. After that, share the invoice images you want me to work on.",
  });

  return NextResponse.json({ id: data.id });
}
