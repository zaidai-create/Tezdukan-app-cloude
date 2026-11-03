import { z } from "zod";

export const addressSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  line1: z.string(),
  line2: z.string().nullable(),
  landmark: z.string().nullable(),
  lat: z.coerce.number().nullable(),
  lng: z.coerce.number().nullable(),
  is_default: z.boolean(),
});
export type SavedAddress = z.infer<typeof addressSchema>;

export const ADDRESS_COLUMNS = "id, label, line1, line2, landmark, lat, lng, is_default";

export const addressLabels = ["Home", "Work", "Other"] as const;
export type AddressLabel = (typeof addressLabels)[number];

export const addressInputSchema = z.object({
  label: z.enum(addressLabels),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional(),
  landmark: z.string().trim().max(120).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  makeDefault: z.boolean().default(true),
});
export type AddressInput = z.input<typeof addressInputSchema>;

/** One line for the order, the dukan and the rider: house and street, then area and landmark. */
export function addressText(address: Pick<SavedAddress, "line1" | "line2" | "landmark">): string {
  return [address.line1, address.line2, address.landmark]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}
