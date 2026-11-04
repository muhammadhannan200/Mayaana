import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // Guidance only: discard legacy email query values before rendering, without
  // exchanging tokens, following next, or changing existing session cookies.
  const query = request.nextUrl.searchParams;
  if (
    request.method === "GET" &&
    request.nextUrl.pathname === "/" &&
    ([
      "code", "token_hash", "access_token", "refresh_token", "error", "error_code",
    ].some((key) => query.has(key)) || query.getAll("type").includes("recovery"))
  )
    return NextResponse.redirect(new URL("/auth/confirm", request.url));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  await supabase.auth.getClaims();
  return response;
}

export const config = { matcher: ["/", "/change-password", "/doctor/:path*", "/secretary/:path*"] };
