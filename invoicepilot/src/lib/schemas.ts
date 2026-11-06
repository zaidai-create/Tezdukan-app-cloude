import { z } from "zod";

// --- Project / message DTOs -------------------------------------------------
export const CreateProjectInput = z.object({
  project_name: z.string().min(1).max(200),
});

export const PostMessageInput = z.object({
  content: z.string().min(1).max(4000),
});

// --- Change plan schema -----------------------------------------------------
// The AI returns a plan matching this shape. Validated strictly before any
// document processing is allowed to begin.
export const InvoiceChange = z.object({
  target: z.object({
    invoice_number: z.string().optional(),
    source_page: z.number().int().min(1).optional(),
    image_index: z.number().int().min(0).optional(),
  }),
  keep_invoice_number: z.boolean().default(true),
  customer_reference: z.string().optional(),
  internal_supply_serial: z.string().optional(),
  internal_adjustment_date: z.string().optional(),
  company_name: z.string().optional(),
  company_address: z.string().optional(),
  ntn: z.string().optional(),
  registration_details: z.string().optional(),
  annotations: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const ChangePlan = z.object({
  summary: z.string(),
  invoices: z.array(z.object({
    label: z.string(),
    changes: InvoiceChange,
  })).min(1),
  needs_more_info: z.boolean().default(false),
  questions: z.array(z.string()).default([]),
});

export type ChangePlanT = z.infer<typeof ChangePlan>;
export type InvoiceChangeT = z.infer<typeof InvoiceChange>;

// --- AI reply envelope ------------------------------------------------------
// Every assistant turn returns this. `next_status` is the proposed next state
// in the workflow; the server validates it against the state machine.
export const AssistantReply = z.object({
  message: z.string(),
  next_status: z.enum([
    "WAITING_FOR_PDF",
    "PDF_RECEIVED",
    "WAITING_FOR_IMAGES",
    "IMAGES_RECEIVED",
    "COLLECTING_CHANGES",
    "CHANGE_SUMMARY",
    "APPROVED",
    "PROCESSING",
    "QUALITY_CHECK",
    "COMPLETED",
    "CANCELLED",
  ]).optional(),
  ask: z.string().optional(),
  plan: ChangePlan.optional(),
});

export type AssistantReplyT = z.infer<typeof AssistantReply>;
