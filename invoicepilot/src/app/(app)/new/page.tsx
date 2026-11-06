"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function NewProjectPage() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_name: name.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create project");
      const { id } = await res.json();
      router.push(`/projects/${id}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">New project</h1>
      <p className="mt-1 text-sm text-ink-muted">Name a project to open its workspace. Uploads and the AI conversation live inside it.</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Project name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. October invoices — Supplier Co"
            className="mt-1 w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-accent"
            required
          />
        </label>
        <button disabled={loading} className="w-full rounded-xl bg-ink px-4 py-3 text-sm font-medium text-surface disabled:opacity-60">
          {loading ? "Creating…" : "Create project"}
        </button>
      </form>
    </div>
  );
}
