"use client";

import { cn } from "cn";
import { Camera, Check, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useId, useState } from "react";
import { SpeedLines } from "@/components/brand/speed-lines";
import { haptic } from "@/lib/haptics";
import { uploadImage } from "@/lib/images/upload";

type State =
  | { step: "empty" }
  | { step: "uploading"; preview: string }
  | { step: "done"; preview: string }
  | { step: "failed"; preview: string; file: File };

// CNIC text must stay readable: a larger long side than product photos.
const DOCUMENT_SIDE = 1800;

/**
 * One document photo as a picture of what is wanted (a CNIC side, the shop from the street) with
 * a camera button on its corner. Tapping it opens the camera (or the gallery); the photo shows at
 * once and uploads in the background to the person's private folder. The storage path goes to
 * `onUploaded`; a failed upload keeps the photo and offers Retry.
 */
export function DocumentPicker({
  userId,
  name,
  caption,
  art,
  shape,
  onUploaded,
}: {
  userId: string;
  /** What the photo is, read by screen readers ("CNIC front"). */
  name: string;
  /** The short word under the box ("Front"); the box itself shows the rest. */
  caption?: string;
  art: ReactNode;
  /** "card": the shape of a CNIC; "wide": a shop front. */
  shape: "card" | "wide";
  onUploaded: (path: string | null) => void;
}) {
  const t = useTranslations("onboarding.documents");
  const inputId = useId();
  const [state, setState] = useState<State>({ step: "empty" });
  const preview = state.step === "empty" ? null : state.preview;

  // The preview is a local object URL: free it when it is replaced or the form goes away.
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const upload = async (file: File, shown: string) => {
    setState({ step: "uploading", preview: shown });
    onUploaded(null);
    try {
      const path = await uploadImage("kyc-documents", userId, file, DOCUMENT_SIDE);
      setState({ step: "done", preview: shown });
      onUploaded(path);
      haptic("success");
    } catch {
      setState({ step: "failed", preview: shown, file });
      haptic("warning");
    }
  };

  const status =
    state.step === "uploading"
      ? t("uploading")
      : state.step === "done"
        ? t("added")
        : state.step === "failed"
          ? t("failed")
          : null;

  return (
    <div className="flex flex-col items-center gap-2">
      <label
        htmlFor={inputId}
        className={cn(
          "relative block w-full cursor-pointer overflow-hidden rounded-[18px] border-[1.5px] transition-[transform,border-color] duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none",
          shape === "card" ? "aspect-[1.6]" : "aspect-[2.1]",
          state.step === "done"
            ? "border-primary"
            : state.step === "failed"
              ? "border-danger"
              : shape === "card"
                ? "border-transparent"
                : "border-border bg-subtle/70",
        )}
      >
        {preview ? (
          // A local preview of the photo just taken; it never leaves the phone as a URL.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          // The CNIC drawing is the card itself; the shop drawing sits on the street.
          <span className={cn("absolute inset-0", shape === "wide" && "px-3 pt-3")}>{art}</span>
        )}
        {state.step === "uploading" ? (
          <span className="absolute inset-0 flex items-center justify-center bg-ink/45">
            <SpeedLines animated tone="on-action" className="w-10" />
          </span>
        ) : null}
        <span
          className={cn(
            "absolute end-2 top-2 flex size-10 items-center justify-center rounded-full shadow-raised",
            state.step === "failed" ? "bg-danger text-on-action" : "bg-action text-on-action",
            "sheen inset-shadow-edge",
          )}
        >
          {state.step === "done" ? (
            <Check aria-hidden className="size-5" strokeWidth={2.5} />
          ) : (
            <Camera aria-hidden className="size-5" strokeWidth={1.75} />
          )}
        </span>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          capture="environment"
          aria-label={name}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            void upload(file, URL.createObjectURL(file));
          }}
        />
      </label>
      {caption || status ? (
        <p className="text-center text-sm">
          {caption ? <span className="font-semibold text-ink">{caption}</span> : null}
          {caption && status ? <span className="text-muted"> · </span> : null}
          {status ? (
            <span
              className={cn(
                state.step === "failed"
                  ? "text-danger-ink"
                  : state.step === "done"
                    ? "text-primary-strong"
                    : "text-muted",
              )}
            >
              {status}
            </span>
          ) : null}
        </p>
      ) : null}
      {state.step === "failed" ? (
        <button
          type="button"
          onClick={() => void upload(state.file, URL.createObjectURL(state.file))}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-danger-soft px-4 text-sm font-semibold text-danger-ink"
        >
          <RotateCcw aria-hidden className="size-4" strokeWidth={1.75} />
          {t("retry")}
        </button>
      ) : null}
    </div>
  );
}
