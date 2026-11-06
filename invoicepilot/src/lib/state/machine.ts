import type { ProjectStatus } from "@/lib/supabase/types";

// Allowed transitions. Guards are enforced server-side before persistence.
const edges: Record<ProjectStatus, ProjectStatus[]> = {
  WAITING_FOR_PDF:     ["PDF_RECEIVED", "CANCELLED"],
  PDF_RECEIVED:        ["WAITING_FOR_IMAGES", "CANCELLED"],
  WAITING_FOR_IMAGES:  ["IMAGES_RECEIVED", "WAITING_FOR_IMAGES", "CANCELLED"],
  IMAGES_RECEIVED:     ["COLLECTING_CHANGES", "CANCELLED"],
  COLLECTING_CHANGES:  ["COLLECTING_CHANGES", "CHANGE_SUMMARY", "CANCELLED"],
  CHANGE_SUMMARY:      ["COLLECTING_CHANGES", "APPROVED", "CANCELLED"],
  APPROVED:            ["PROCESSING", "CANCELLED"],
  PROCESSING:          ["QUALITY_CHECK", "CANCELLED"],
  QUALITY_CHECK:       ["COMPLETED", "PROCESSING", "CANCELLED"],
  COMPLETED:           [],
  CANCELLED:           [],
};

export function canTransition(from: ProjectStatus, to: ProjectStatus) {
  return edges[from]?.includes(to) ?? false;
}

export function nextAutoStatus(current: ProjectStatus, hasPdf: boolean, hasImages: boolean): ProjectStatus {
  if (current === "WAITING_FOR_PDF" && hasPdf) return "PDF_RECEIVED";
  if (current === "PDF_RECEIVED") return "WAITING_FOR_IMAGES";
  if (current === "WAITING_FOR_IMAGES" && hasImages) return "WAITING_FOR_IMAGES";
  return current;
}

export const STATE_LABELS: Record<ProjectStatus, string> = {
  WAITING_FOR_PDF: "Waiting for PDF",
  PDF_RECEIVED: "PDF received",
  WAITING_FOR_IMAGES: "Waiting for images",
  IMAGES_RECEIVED: "Images received",
  COLLECTING_CHANGES: "Collecting changes",
  CHANGE_SUMMARY: "Change summary",
  APPROVED: "Approved",
  PROCESSING: "Processing",
  QUALITY_CHECK: "Quality check",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
