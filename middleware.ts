import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/**
 * LearnAI Route & Session Middleware.
 * Refreshes Supabase session tokens via cookies and protects routes:
 * - Fails CLOSED on any environment misconfiguration or authentication error.
 * - Unauthenticated requests targeting /api/* return 401 { error: "Unauthorized", code: "UNAUTHORIZED" }.
 * - Unauthenticated page navigations redirect to /login.
 * - Authenticated users accessing /login redirect to /chat.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === "/login";
  const isAuthCallback = pathname.startsWith("/auth/callback");

  // Fail closed: if configuration is missing, block API and redirect pages
  if (!supabaseUrl || !supabaseAnonKey) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Server environment misconfigured", code: "CONFIG_ERROR" },
        { status: 500 }
      );
    }
    if (!isLoginPage && !isAuthCallback) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  let user = null;
  try {
    const supabase = createServerClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user: verifiedUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (!authError && verifiedUser) {
      user = verifiedUser;
    }
  } catch (err) {
    console.error("[Middleware Fail-Closed] Auth verification exception:", err);
    user = null;
  }

  // 1. Authenticated user visiting /login -> redirect to /chat
  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/chat";
    return NextResponse.redirect(url);
  }

  // 2. Unauthenticated user handling (fail closed)
  if (!user && !isLoginPage && !isAuthCallback) {
    // Unauthenticated API request -> return 401 JSON
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Unauthenticated page navigation -> redirect to /login
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Public image/asset files (.svg, .png, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
