import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { Workspace } from "./workspace";
import type { DocumentRow, Message, Project, ChangePlan } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await getSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return notFound();

  const { data: project } = await sb
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (!project) return notFound();

  const [{ data: docs }, { data: messages }, { data: plan }, { data: job }] = await Promise.all([
    sb.from("documents").select("*").eq("project_id", id).order("created_at"),
    sb.from("messages").select("*").eq("project_id", id).order("created_at"),
    sb.from("change_plans").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("processing_jobs").select("id, status, output_path, quality_report, created_at, completed_at").eq("project_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return (
    <Workspace
      project={project as Project}
      initialDocuments={(docs ?? []) as DocumentRow[]}
      initialMessages={(messages ?? []) as Message[]}
      initialPlan={(plan ?? null) as ChangePlan | null}
      initialJob={(job as { id: string; status: string; output_path: string | null; quality_report: unknown; created_at: string; completed_at: string | null } | null) ?? null}
    />
  );
}
