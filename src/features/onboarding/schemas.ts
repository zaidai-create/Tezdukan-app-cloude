import { z } from "zod";

export const areaSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  name_ur: z.string().nullable(),
  center_lat: z.coerce.number().nullable(),
  center_lng: z.coerce.number().nullable(),
});
export type Area = z.infer<typeof areaSchema>;

const business = {
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(10).max(20),
  areaId: z.uuid(),
  address: z.string().trim().min(3).max(300),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
};

/** A CNIC: 13 digits, written 41303-1234567-1. */
export const cnicSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .pipe(z.string().regex(/^\d{13}$/));

/** "4130312345671" → "41303-1234567-1" (as printed on the card). */
export function formatCnic(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 13);
  if (d.length <= 5) return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}

// Storage paths of the uploaded photos, inside the applicant's own folder.
const documentPath = z.string().min(3).max(300);
const documents = {
  cnic: cnicSchema,
  cnicFrontPath: documentPath,
  cnicBackPath: documentPath,
  placePhotoPath: documentPath,
  ntn: z.string().trim().max(20).optional(),
  strn: z.string().trim().max(20).optional(),
};

export const registerDukanSchema = z.object({ ...business, ...documents });
export type RegisterDukanInput = z.input<typeof registerDukanSchema>;

export const registerDistributorSchema = z.object({
  ...business,
  ...documents,
  servedAreaIds: z.array(z.uuid()).max(30),
});
export type RegisterDistributorInput = z.input<typeof registerDistributorSchema>;

export const registrationErrors = [
  "invalid_name",
  "invalid_phone",
  "address_required",
  "invalid_area",
  "too_many_pending_registrations",
  "invalid_cnic",
  "documents_required",
  "location_required",
  "generic",
] as const;
export type RegistrationError = (typeof registrationErrors)[number];

export const applicationSchema = z.object({
  kind: z.enum(["dukan", "distributor"]),
  id: z.uuid(),
  name: z.string(),
  status: z.enum(["draft", "pending", "approved", "rejected", "suspended"]),
  rejection_reason: z.string().nullable(),
  submitted_at: z.string().nullable(),
  approved_at: z.string().nullable(),
  has_documents: z.boolean(),
});
export type Application = z.infer<typeof applicationSchema>;

export function registrationErrorKey(message: string | undefined): RegistrationError {
  const key = registrationErrors.find((candidate) => message === candidate);
  return key ?? "generic";
}
