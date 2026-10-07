import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Validates the `next` redirect target parameter to ensure only relative,
 * same-origin paths are accepted, preventing open redirect vulnerabilities.
 */
function getSafeRedirectPath(nextParam: string | null): string {
  if (!nextParam) {
    return "/chat";
  }

  // Ensure path is relative and starts with a single forward slash (disallow protocol-relative //)
  if (nextParam.startsWith("/") && !nextParam.startsWith("//")) {
    return nextParam;
  }

  return "/chat";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  const safeRedirectPath = getSafeRedirectPath(next);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${safeRedirectPath}`);
    }
  }

  // If code exchange fails or code is missing, redirect to login with error flag
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
