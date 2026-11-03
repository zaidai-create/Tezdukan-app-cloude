"use server";

import { z } from "zod";
import { signOutAction } from "@/features/auth/actions";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type DeletionResult = { ok: true } | { ok: false; error: "generic" | "signed_out" };

/** Files the deletion request, then signs this device out. */
export async function requestAccountDeletion(reason: string): Promise<DeletionResult> {
  const text = z.string().trim().max(1000).catch("").parse(reason);
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { ok: false, error: "signed_out" };
  const { error } = await supabase.rpc("request_account_deletion", { p_reason: text || undefined });
  if (error) return { ok: false, error: "generic" };
  await signOutAction();
  return { ok: true };
}
