import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import {
  CONTEXT_COOKIE,
  isAuthPath,
  isPublicPath,
  parseContext,
  roleHome,
  WELCOMED_COOKIE,
} from "@/lib/auth/roles";
import { refreshSession } from "@/lib/supabase/proxy";

const handleI18n = createIntlMiddleware(routing);
const CACHE_HEADERS = ["cache-control", "expires", "pragma"] as const;

/**
 * Every page request: locale rewrite (cookie → /[locale]/…), Supabase session refresh, then
 * routing by session and active role. Authorisation of data is enforced by RLS; this only
 * decides where people land.
 */
export default async function proxy(request: NextRequest) {
  const response = handleI18n(request);
  if (response.headers.has("location")) return response;

  const claims = await refreshSession(request, response);
  const { pathname, search } = request.nextUrl;

  const redirect = (path: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = params ? `?${new URLSearchParams(params)}` : "";
    const res = NextResponse.redirect(url);
    // Keep refreshed auth cookies and their no-store headers on the redirect.
    for (const cookie of response.cookies.getAll()) res.cookies.set(cookie);
    for (const header of CACHE_HEADERS) {
      const value = response.headers.get(header);
      if (value) res.headers.set(header, value);
    }
    return res;
  };

  if (!claims) {
    if (isPublicPath(pathname)) return response;
    // First launch on this device: the welcome posters before sign-in.
    if (pathname === "/" && !request.cookies.has(WELCOMED_COOKIE)) return redirect("/welcome");
    return redirect("/login", pathname === "/" ? undefined : { next: `${pathname}${search}` });
  }

  const context = parseContext(request.cookies.get(CONTEXT_COOKIE)?.value);
  const home = roleHome[context?.role ?? "customer"];

  if (isAuthPath(pathname)) return redirect(home);
  if (pathname === "/" && home !== "/") return redirect(home);

  return response;
}

export const config = {
  // Pages only: skip API routes, the service worker route, Next internals and files.
  matcher: ["/((?!api|serwist|_next|_vercel|.*\\..*).*)"],
};
