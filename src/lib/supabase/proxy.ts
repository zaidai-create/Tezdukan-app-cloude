import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { publicEnv } from "@/lib/env";

/**
 * Refreshes the Supabase session for this request and writes refreshed cookies (plus the
 * no-store cache headers) onto `response`. Returns the verified claims, or null when signed out.
 * Must run before the response is committed; called first thing in proxy.ts.
 */
export async function refreshSession(request: NextRequest, response: NextResponse) {
  let cacheHeaders: Record<string, string> = {};
  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
          cacheHeaders = { ...cacheHeaders, ...headers };
        },
      },
    },
  );

  // getClaims verifies the JWT signature (locally with asymmetric keys), unlike getSession.
  const { data } = await supabase.auth.getClaims();
  for (const [key, value] of Object.entries(cacheHeaders)) response.headers.set(key, value);
  return data?.claims ?? null;
}
