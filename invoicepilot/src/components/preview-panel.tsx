"use client";

import { useState } from "react";
import type { DocumentRow } from "@/lib/supabase/types";

export function PreviewPanel({
  pdf, images, projectId,
}: {
  pdf: DocumentRow | null;
  images: DocumentRow[];
  projectId: string;
}) {
  const [active, setActive] = useState<"pdf" | number>("pdf");

  if (!pdf && images.length === 0) {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-4 h-16 w-16 rounded-3xl bg-surface shadow-card grid place-items-center">
            <span className="text-2xl">📄</span>
          </div>
          <h2 className="text-lg font-semibold">Upload a PDF to begin</h2>
          <p className="mt-1 text-sm text-ink-muted">Drag a file into the Upload panel, or tap it to pick one. The AI will guide you from there.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-2 overflow-x-auto scrollbar-thin border-b border-line bg-surface px-4 py-2">
        {pdf && (
          <TabButton active={active === "pdf"} onClick={() => setActive("pdf")}>
            {pdf.original_filename}
          </TabButton>
        )}
        {images.map((img, idx) => (
          <TabButton key={img.id} active={active === idx} onClick={() => setActive(idx)}>
            Image {idx + 1}
          </TabButton>
        ))}
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin bg-surface-panel p-6">
        {active === "pdf" && pdf ? (
          <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl bg-surface shadow-card">
            <object
              data={`/api/projects/${projectId}/documents/${pdf.id}/preview#toolbar=0&navpanes=0`}
              type="application/pdf"
              className="h-[75vh] w-full"
            >
              <div className="p-10 text-center text-sm text-ink-muted">
                Your browser cannot inline this PDF.{" "}
                <a className="text-accent underline" href={`/api/projects/${projectId}/documents/${pdf.id}/preview`}>Open it</a>.
              </div>
            </object>
          </div>
        ) : typeof active === "number" && images[active] ? (
          <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl bg-surface shadow-card p-3">
            <img
              src={`/api/projects/${projectId}/documents/${images[active].id}/preview`}
              alt={images[active].original_filename}
              className="mx-auto max-h-[75vh] max-w-full object-contain"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TabButton({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={
        "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition " +
        (active ? "bg-ink text-surface" : "bg-surface-panel text-ink-muted hover:text-ink")
      }
    >
      {children}
    </button>
  );
}
