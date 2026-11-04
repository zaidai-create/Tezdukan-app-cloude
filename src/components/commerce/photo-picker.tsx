"use client";

import { cn } from "cn";
import { Camera, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import type * as React from "react";
import { type ImageBucket, uploadImage } from "@/lib/images/upload";

/**
 * Opens the phone's gallery or camera, shrinks the photo and uploads it, then hands back the
 * storage path. The child is the visible control; this adds the hidden file input.
 */
export function PhotoPicker({
  bucket,
  folder,
  maxSide = 1000,
  label,
  onUploaded,
  onError,
  className,
  children,
}: {
  bucket: ImageBucket;
  folder: string;
  maxSide?: number;
  label: string;
  onUploaded: (path: string, previewUrl: string) => void;
  onError: () => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const path = await uploadImage(bucket, folder, file, maxSide);
      onUploaded(path, URL.createObjectURL(file));
    } catch {
      onError();
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => void pick(event.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label={label}
        className={cn("relative disabled:opacity-80", className)}
      >
        {/* The label names the action; what is shown (a photo, initials) is decoration. */}
        <span aria-hidden className="contents">
          {children ?? <Camera className="size-5" strokeWidth={1.75} />}
        </span>
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-overlay/40">
            <Loader2
              aria-hidden
              className="size-6 animate-spin text-on-action motion-reduce:animate-none"
            />
          </span>
        ) : null}
      </button>
    </>
  );
}
