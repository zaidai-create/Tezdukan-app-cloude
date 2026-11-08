import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type SetCookie = { name: string; value: string; options: CookieOptions };

// Refresh the Supabase session on every request and guard protected routes.
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return res;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet: SetCookie[]) => {
        for (const { name, value, options } of cookiesToSet) {
          res.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const isAuthRoute = req.nextUrl.pathname.startsWith("/signin");
  const isApi = req.nextUrl.pathname.startsWith("/api");

  if (!data.user && !isAuthRoute && !isApi && req.nextUrl.pathname !== "/") {
    return NextResponse.redirect(new URL("/signin", req.url));
  }
  if (data.user && isAuthRoute) {
    return NextResponse.redirect(new URL("/projects", req.url));
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|.*\\..*).*)"],
};
