"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireDukan } from "@/features/ordering/data";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  type ShopStorefront,
  type StorefrontTerms,
  shopStorefrontSchema,
  storefrontTermsSchema,
} from "./schemas";

/** Online-dukan writes for the dukandar's active dukan; the dukan always comes from the session. */

export type StorefrontError =
  "generic" | "not_allowed" | "no_products" | "not_approved" | "invalid";
export type StorefrontResult =
  { ok: true; data: ShopStorefront } | { ok: false; error: StorefrontError };

function errorKey(message: string | undefined): StorefrontError {
  if (message === "not_allowed") return "not_allowed";
  if (message === "no_products") return "no_products";
  if (message === "shop_not_approved") return "not_approved";
  if (message === "invalid_eta" || message === "invalid_amount" || message === "invalid_input") {
    return "invalid";
  }
  return "generic";
}

async function update(args: {
  p_is_live: boolean;
  p_eta_minutes?: number;
  p_min_order_paisa?: number;
  p_delivery_fee_paisa?: number;
  p_free_delivery_above_paisa?: number;
  p_tagline?: string;
}): Promise<StorefrontResult> {
  const { shopId } = await requireDukan("/dukan/store");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("update_shop_storefront", {
    p_shop_id: shopId,
    ...args,
  });
  if (error) return { ok: false, error: errorKey(error.message) };
  const result = shopStorefrontSchema.safeParse(data);
  if (!result.success) return { ok: false, error: "generic" };
  refresh();
  return { ok: true, data: result.data };
}

/** Switch online orders on or off, keeping the delivery terms. */
export async function setOnline(isLive: boolean): Promise<StorefrontResult> {
  const parsed = z.boolean().safeParse(isLive);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return update({ p_is_live: parsed.data });
}

/** Save the delivery terms (and keep the online switch where it is). */
export async function saveStorefront(
  isLive: boolean,
  terms: StorefrontTerms,
): Promise<StorefrontResult> {
  const live = z.boolean().safeParse(isLive);
  const parsed = storefrontTermsSchema.safeParse(terms);
  if (!live.success || !parsed.success) return { ok: false, error: "invalid" };
  return update({
    p_is_live: live.data,
    p_eta_minutes: parsed.data.eta_minutes,
    p_min_order_paisa: parsed.data.min_order_paisa,
    p_delivery_fee_paisa: parsed.data.delivery_fee_paisa,
    p_free_delivery_above_paisa: parsed.data.free_delivery_above_paisa,
    p_tagline: parsed.data.tagline,
  });
}
