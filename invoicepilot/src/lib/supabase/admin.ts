import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client. Only import from server-only, audited code (API routes
// and Server Actions). Bypasses RLS — callers MUST verify the current user.
export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) throw new Error("Supabase service env vars are not configured");
  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
