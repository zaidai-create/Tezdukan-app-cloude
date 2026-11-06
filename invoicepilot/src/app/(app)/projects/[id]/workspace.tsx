"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { STATE_LABELS } from "@/lib/state/machine";
import type { DocumentRow, Message, Project, ChangePlan, ProjectStatus } from "@/lib/supabase/types";
import type { ChangePlanT } from "@/lib/schemas";
import { UploadPanel } from "@/components/upload-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { Chat } from "@/components/chat";
import { ChangeSummary } from "@/components/change-summary";
import { cn } from "@/lib/cn";

type JobLite = { id: string; status: string; output_path: string | null; quality_report: unknown; created_at: string; completed_at: string | null } | null;

export function Workspace(props: {
  project: Project;
  initialDocuments: DocumentRow[];
  initialMessages: Message[];
  initialPlan: ChangePlan | null;
  initialJob: JobLite;
}) {
  const [project, setProject] = useState(props.project);
  const [documents, setDocuments] = useState(props.initialDocuments);
  const [messages, setMessages] = useState(props.initialMessages);
  const [plan, setPlan] = useState<ChangePlan | null>(props.initialPlan);
  const [job, setJob] = useState<JobLite>(props.initialJob);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const pdfDoc = useMemo(() => documents.find((d) => d.document_type === "pdf") ?? null, [documents]);
  const images = useMemo(() => documents.filter((d) => d.document_type === "image"), [documents]);

  async function refresh() {
    const r = await fetch(`/api/projects/${project.id}/state`, { cache: "no-store" });
    if (!r.ok) return;
    const data = await r.json();
    setProject(data.project);
    setDocuments(data.documents);
    setMessages(data.messages);
    setPlan(data.plan);
    setJob(data.job);
  }

  // Poll while actively processing.
  useEffect(() => {
    if (project.status === "PROCESSING" || project.status === "QUALITY_CHECK") {
      pollRef.current = setInterval(refresh, 1500);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.status]);

  async function sendMessage(content: string) {
    setBusy(true);
    setMessages((m) => [...m, pseudoMsg("user", content)]);
    try {
      const r = await fetch(`/api/projects/${project.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Message failed");
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function markImagesDone() {
    setBusy(true);
    try {
      const r = await fetch(`/api/projects/${project.id}/images-done`, { method: "POST" });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!plan) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/projects/${project.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Approval failed");
      await refresh();
      // Kick processing immediately.
      await fetch(`/api/projects/${project.id}/process`, { method: "POST" });
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!confirm("Cancel this project? No files will be modified.")) return;
    setBusy(true);
    try {
      await fetch(`/api/projects/${project.id}/cancel`, { method: "POST" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const planT = plan?.changes_json as ChangePlanT | null | undefined;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-line bg-surface/80 backdrop-blur-xl px-5 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{project.project_name}</div>
          <div className="text-xs text-ink-muted">{STATE_LABELS[project.status as ProjectStatus]}</div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={project.status as ProjectStatus} />
          {project.status !== "COMPLETED" && project.status !== "CANCELLED" && (
            <button onClick={cancel} className="rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-surface-panel">
              Cancel
            </button>
          )}
        </div>
      </header>

      <div className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-[320px_1fr_380px]">
        <section className="border-r border-line bg-surface p-4 overflow-y-auto scrollbar-thin">
          <UploadPanel
            projectId={project.id}
            status={project.status as ProjectStatus}
            documents={documents}
            onChanged={refresh}
            onMarkImagesDone={markImagesDone}
          />
        </section>

        <section className="min-w-0 bg-surface-elevated">
          {planT && project.status === "CHANGE_SUMMARY" ? (
            <ChangeSummary
              plan={planT}
              onApprove={approve}
              onModify={() => toast("Describe the changes in chat; the AI will produce a new summary.")}
              onCancel={cancel}
              busy={busy}
            />
          ) : job && project.status === "COMPLETED" ? (
            <CompletedPanel jobId={job.id} report={job.quality_report} />
          ) : (
            <PreviewPanel pdf={pdfDoc} images={images} projectId={project.id} />
          )}
        </section>

        <section className="border-l border-line bg-surface flex flex-col min-h-0">
          <Chat
            messages={messages}
            status={project.status as ProjectStatus}
            onSend={sendMessage}
            busy={busy}
          />
        </section>
      </div>
    </div>
  );
}

function pseudoMsg(role: Message["role"], content: string): Message {
  return {
    id: `tmp-${Math.random().toString(36).slice(2)}`,
    project_id: "", role, content, metadata: null,
    created_at: new Date().toISOString(),
  };
}

function StatusPill({ status }: { status: ProjectStatus }) {
  const tone =
    status === "COMPLETED" ? "bg-success/15 text-success"
    : status === "CANCELLED" ? "bg-danger/15 text-danger"
    : status === "PROCESSING" || status === "QUALITY_CHECK" ? "bg-warning/15 text-warning"
    : "bg-accent-soft text-accent";
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide", tone)}>
      {STATE_LABELS[status]}
    </span>
  );
}

function CompletedPanel({ jobId, report }: { jobId: string; report: unknown }) {
  const r = report as { pageCount?: number; ok?: boolean; issues?: string[] } | null;
  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="rounded-3xl bg-surface shadow-raised p-8">
        <div className="mb-4 h-12 w-12 rounded-2xl bg-success/15 text-success grid place-items-center">✓</div>
        <h2 className="text-2xl font-semibold tracking-tight">Processing complete</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Output verified{r?.pageCount ? ` — ${r.pageCount} pages` : ""}.
          {r?.ok === false ? " Review quality notes below." : ""}
        </p>
        <div className="mt-6 flex gap-2">
          <a href={`/api/jobs/${jobId}/download`} className="rounded-xl bg-ink px-4 py-3 text-sm font-medium text-surface">Download final PDF</a>
        </div>
        {r?.issues?.length ? (
          <ul className="mt-6 space-y-1 text-xs text-ink-muted">
            {r.issues.map((i, idx) => <li key={idx}>• {i}</li>)}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
