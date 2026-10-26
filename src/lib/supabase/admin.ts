import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";
import type { Database } from "./database.types";

/**
 * Secret-key client that BYPASSES RLS. Only for narrow, audited server tasks: reading the
 * Sandbox SMS outbox, admin password resets, webhooks. Never pass its results to the client
 * without filtering, and never use it for anything a user's own session can do.
 */
export function getSupabaseAdminClient() {
  if (!serverEnv.SUPABASE_SECRET_KEY) {
    throw new Error("SUPABASE_SECRET_KEY is not set; admin operations are unavailable.");
  }
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hasAdminClient(): boolean {
  return Boolean(serverEnv.SUPABASE_SECRET_KEY);
}
