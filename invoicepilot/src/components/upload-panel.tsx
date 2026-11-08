"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import type { DocumentRow, ProjectStatus } from "@/lib/supabase/types";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/cn";

export function UploadPanel(props: {
  projectId: string;
  status: ProjectStatus;
  documents: DocumentRow[];
  onChanged: () => void;
  onMarkImagesDone: () => void;
}) {
  const { projectId, status, documents, onChanged, onMarkImagesDone } = props;
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState<"pdf" | "image" | null>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const pdfs = documents.filter((d) => d.document_type === "pdf");
  const images = documents.filter((d) => d.document_type === "image");

  const wantsPdf = status === "WAITING_FOR_PDF";
  const wantsImages = status === "PDF_RECEIVED" || status === "WAITING_FOR_IMAGES" || status === "IMAGES_RECEIVED";
  const locked = ["APPROVED", "PROCESSING", "QUALITY_CHECK", "COMPLETED", "CANCELLED"].includes(status);

  async function upload(files: FileList | null) {
    if (!files || !files.length || locked) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const r = await fetch(`/api/projects/${projectId}/upload`, { method: "POST", body: form });
        if (!r.ok) {
          const err = (await r.json()).error ?? "Upload failed";
          toast.error(`${file.name}: ${err}`);
          continue;
        }
      }
      onChanged();
    } finally {
      setUploading(false);
      if (pdfRef.current) pdfRef.current.value = "";
      if (imgRef.current) imgRef.current.value = "";
    }
  }

  async function remove(docId: string) {
    const r = await fetch(`/api/projects/${projectId}/documents/${docId}`, { method: "DELETE" });
    if (!r.ok) toast.error("Could not remove");
    onChanged();
  }

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-medium text-ink-muted">Uploads</h3>

      <DropZone
        label="Upload PDF"
        hint={pdfs.length ? "Replace the current PDF" : "Drag a PDF here, or tap to choose"}
        accept="application/pdf"
        active={wantsPdf}
        locked={locked}
        dragOver={dragOver === "pdf"}
        onEnter={() => setDragOver("pdf")}
        onLeave={() => setDragOver(null)}
        onPick={() => pdfRef.current?.click()}
        onDrop={(f) => upload(f)}
        uploading={uploading}
      >
        <input ref={pdfRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => upload(e.target.files)} />
      </DropZone>

      <ul className="space-y-2">
        {pdfs.map((d) => (
          <FileRow key={d.id} doc={d} onRemove={!locked ? () => remove(d.id) : undefined} />
        ))}
      </ul>

      <DropZone
        label="Upload invoice images"
        hint="JPG, PNG or WebP — you can add many"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        multiple
        active={wantsImages}
        locked={locked || !pdfs.length}
        dragOver={dragOver === "image"}
        onEnter={() => setDragOver("image")}
        onLeave={() => setDragOver(null)}
        onPick={() => imgRef.current?.click()}
        onDrop={(f) => upload(f)}
        uploading={uploading}
      >
        <input
          ref={imgRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          multiple
          capture="environment"
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
      </DropZone>

      <ul className="grid grid-cols-3 gap-2">
        {images.map((d) => (
          <ImageThumb key={d.id} doc={d} projectId={projectId} onRemove={!locked ? () => remove(d.id) : undefined} />
        ))}
      </ul>

      {status === "WAITING_FOR_IMAGES" && images.length > 0 && (
        <button
          onClick={onMarkImagesDone}
          className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium hover:bg-surface-panel"
        >
          That is all the images — continue
        </button>
      )}
    </div>
  );
}

function DropZone(props: {
  label: string; hint: string; accept: string; multiple?: boolean;
  active: boolean; locked: boolean; dragOver: boolean; uploading: boolean;
  onEnter: () => void; onLeave: () => void; onPick: () => void; onDrop: (files: FileList) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onDragOver={(e) => { if (!props.locked) { e.preventDefault(); props.onEnter(); } }}
      onDragLeave={props.onLeave}
      onDrop={(e) => {
        e.preventDefault();
        props.onLeave();
        if (!props.locked) props.onDrop(e.dataTransfer.files);
      }}
      onClick={() => !props.locked && props.onPick()}
      className={cn(
        "cursor-pointer rounded-2xl border-2 border-dashed p-4 transition",
        props.locked ? "cursor-not-allowed opacity-50 border-line" :
        props.active ? "border-accent bg-accent-soft/40" :
        props.dragOver ? "border-accent bg-accent-soft/60" :
        "border-line hover:border-ink-muted bg-surface-panel/30"
      )}
    >
      <div className="text-sm font-medium">{props.label}</div>
      <div className="text-xs text-ink-muted">{props.hint}</div>
      {props.uploading && <div className="mt-2 text-xs text-accent">Uploading…</div>}
      {props.children}
    </div>
  );
}

function FileRow({ doc, onRemove }: { doc: DocumentRow; onRemove?: () => void }) {
  return (
    <li className="flex items-center justify-between rounded-xl bg-surface-panel/60 px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm">{doc.original_filename}</div>
        <div className="text-[11px] tabular text-ink-muted">
          {formatBytes(doc.size_bytes)}{doc.page_count ? ` · ${doc.page_count} pages` : ""}
        </div>
      </div>
      {onRemove && (
        <button onClick={onRemove} className="text-xs text-ink-muted hover:text-danger">Remove</button>
      )}
    </li>
  );
}

function ImageThumb({ doc, projectId, onRemove }: { doc: DocumentRow; projectId: string; onRemove?: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-surface-panel aspect-square">
      <img
        src={`/api/projects/${projectId}/documents/${doc.id}/preview`}
        alt={doc.original_filename}
        className="h-full w-full object-cover"
        loading="lazy"
      />
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute right-1 top-1 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-medium text-surface"
        >
          ×
        </button>
      )}
    </div>
  );
}
