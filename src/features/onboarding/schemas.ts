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

export const registerDukanSchema = z.object(business);
export type RegisterDukanInput = z.infer<typeof registerDukanSchema>;

export const registerDistributorSchema = z.object({
  ...business,
  servedAreaIds: z.array(z.uuid()).max(30),
});
export type RegisterDistributorInput = z.infer<typeof registerDistributorSchema>;

export const nearbyDukanSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  address_line: z.string().nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  photo_path: z.string().nullable(),
  area_name: z.string().nullable(),
  area_name_ur: z.string().nullable(),
  distance_m: z.number().nullable(),
});
export type NearbyDukan = z.infer<typeof nearbyDukanSchema>;

/** Set when someone picks "I'm a customer", so sign-in stops offering the role choice. */
export const START_DONE_COOKIE = "td_start_done";

export const registrationErrors = [
  "invalid_name",
  "invalid_phone",
  "address_required",
  "invalid_area",
  "too_many_pending_registrations",
  "generic",
] as const;
export type RegistrationError = (typeof registrationErrors)[number];

export function registrationErrorKey(message: string | undefined): RegistrationError {
  const key = registrationErrors.find((candidate) => message === candidate);
  return key ?? "generic";
}
