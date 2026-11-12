"use server";

import { z } from "zod";
import { switchContextAction } from "@/features/auth/actions";
import { normalizePkMobile } from "@/lib/phone";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  registerDistributorSchema,
  registerDukanSchema,
  registrationErrorKey,
  type RegisterDistributorInput,
  type RegisterDukanInput,
  type RegistrationError,
} from "./schemas";

export type RegistrationResult =
  { ok: true; data: { approved: boolean; home: string } } | { ok: false; error: RegistrationError };

const registeredSchema = z.object({ id: z.uuid(), status: z.string() });

// Hyderabad city centre: used when neither the phone nor the area gives a location.
const HYDERABAD = { lat: 25.396, lng: 68.3578 };

async function locate(areaId: string, lat: number | null, lng: number | null) {
  if (lat !== null && lng !== null) return { lat, lng };
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("service_areas")
    .select("center_lat, center_lng")
    .eq("id", areaId)
    .maybeSingle();
  const areaLat = Number(data?.center_lat);
  const areaLng = Number(data?.center_lng);
  return Number.isFinite(areaLat) && Number.isFinite(areaLng) && data?.center_lat != null
    ? { lat: areaLat, lng: areaLng }
    : HYDERABAD;
}

/** Which part of the form a failed parse points at, for a message the person can act on. */
function parseError(issues: { path: PropertyKey[] }[]): RegistrationError {
  const field = issues[0]?.path[0];
  if (field === "cnic") return "invalid_cnic";
  if (field === "cnicFrontPath" || field === "cnicBackPath" || field === "placePhotoPath")
    return "documents_required";
  if (field === "name") return "invalid_name";
  if (field === "address") return "address_required";
  if (field === "areaId") return "invalid_area";
  return "generic";
}

/**
 * Applies for a dukan with the owner's CNIC and a photo of the shop. It waits for the TezDukan
 * team; if auto-approval is switched on (testing) it becomes the person's active role at once.
 */
export async function registerDukan(input: RegisterDukanInput): Promise<RegistrationResult> {
  const parsed = registerDukanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parseError(parsed.error.issues) };
  const phone = normalizePkMobile(parsed.data.phone);
  if (!phone) return { ok: false, error: "invalid_phone" };
  const { lat, lng } = await locate(parsed.data.areaId, parsed.data.lat, parsed.data.lng);

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("apply_for_dukan", {
    p_name: parsed.data.name,
    p_phone: phone,
    p_address_line: parsed.data.address,
    p_area_id: parsed.data.areaId,
    p_lat: lat,
    p_lng: lng,
    p_cnic_number: parsed.data.cnic,
    p_cnic_front_path: parsed.data.cnicFrontPath,
    p_cnic_back_path: parsed.data.cnicBackPath,
    p_shop_photo_path: parsed.data.placePhotoPath,
    p_ntn: parsed.data.ntn || undefined,
    p_strn: parsed.data.strn || undefined,
  });
  const shop = registeredSchema.safeParse(data);
  if (error || !shop.success) return { ok: false, error: registrationErrorKey(error?.message) };

  const approved = shop.data.status === "approved";
  if (approved) {
    const switched = await switchContextAction("dukandar", shop.data.id);
    if (switched.ok) return { ok: true, data: { approved, home: switched.data.home } };
  }
  return { ok: true, data: { approved, home: "/account" } };
}

/** Applies for a distributor business with the areas it delivers to, CNIC and a place photo. */
export async function registerDistributor(
  input: RegisterDistributorInput,
): Promise<RegistrationResult> {
  const parsed = registerDistributorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parseError(parsed.error.issues) };
  const phone = normalizePkMobile(parsed.data.phone);
  if (!phone) return { ok: false, error: "invalid_phone" };
  const { lat, lng } = await locate(parsed.data.areaId, parsed.data.lat, parsed.data.lng);
  const served = [...new Set([parsed.data.areaId, ...parsed.data.servedAreaIds])];

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("apply_for_distributor", {
    p_name: parsed.data.name,
    p_phone: phone,
    p_address_line: parsed.data.address,
    p_area_id: parsed.data.areaId,
    p_lat: lat,
    p_lng: lng,
    p_served_area_ids: served,
    p_cnic_number: parsed.data.cnic,
    p_cnic_front_path: parsed.data.cnicFrontPath,
    p_cnic_back_path: parsed.data.cnicBackPath,
    p_place_photo_path: parsed.data.placePhotoPath,
    p_ntn: parsed.data.ntn || undefined,
    p_strn: parsed.data.strn || undefined,
  });
  const org = registeredSchema.safeParse(data);
  if (error || !org.success) return { ok: false, error: registrationErrorKey(error?.message) };

  const approved = org.data.status === "approved";
  if (approved) {
    const switched = await switchContextAction("distributor", org.data.id);
    if (switched.ok) return { ok: true, data: { approved, home: switched.data.home } };
  }
  return { ok: true, data: { approved, home: "/account" } };
}
