/**
 * Service-role Supabase client for the seed scripts. Server-side tooling only: it uses the secret
 * key, so never import this from app code.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/supabase/database.types";

export type SeedClient = SupabaseClient<Database>;

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Add it to .env.local (values from \`pnpm db:status\`).`);
  }
  return value;
}

export function supabaseUrl(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
}

/** True for the local Docker stack, where demo users are safe to create. */
export function isLocalUrl(url: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0)(:\d+)?(\/|$)/.test(url);
}

export function createSeedClient(): SeedClient {
  return createClient<Database>(supabaseUrl(), requireEnv("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
