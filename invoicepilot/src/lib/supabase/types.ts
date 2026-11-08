// Hand-written DB types. Replace with generated types in production via
// `supabase gen types typescript`. These are narrow enough for the app's needs.

export type ProjectStatus =
  | "WAITING_FOR_PDF"
  | "PDF_RECEIVED"
  | "WAITING_FOR_IMAGES"
  | "IMAGES_RECEIVED"
  | "COLLECTING_CHANGES"
  | "CHANGE_SUMMARY"
  | "APPROVED"
  | "PROCESSING"
  | "QUALITY_CHECK"
  | "COMPLETED"
  | "CANCELLED";

export type DocumentKind = "pdf" | "image";
export type ChangePlanStatus = "draft" | "awaiting_approval" | "approved" | "rejected";
export type JobStatus = "queued" | "running" | "succeeded" | "failed";
export type ChatRole = "system" | "assistant" | "user";

export type Project = {
  id: string;
  user_id: string;
  project_name: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
};

export type DocumentRow = {
  id: string;
  project_id: string;
  original_filename: string;
  storage_path: string;
  document_type: DocumentKind;
  mime_type: string;
  size_bytes: number;
  page_count: number | null;
  created_at: string;
};

export type Invoice = {
  id: string;
  project_id: string;
  document_id: string | null;
  invoice_number: string | null;
  source_page: number | null;
  extracted_data: Record<string, unknown>;
  confidence: number | null;
  created_at: string;
};

export type ChangePlan = {
  id: string;
  project_id: string;
  changes_json: unknown;
  status: ChangePlanStatus;
  created_at: string;
  approved_at: string | null;
};

export type ProcessingJob = {
  id: string;
  project_id: string;
  change_plan_id: string | null;
  status: JobStatus;
  output_path: string | null;
  quality_report: unknown;
  error: string | null;
  created_at: string;
  completed_at: string | null;
};

export type Message = {
  id: string;
  project_id: string;
  role: ChatRole;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};
