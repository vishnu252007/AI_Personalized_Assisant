import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Standard API error response helper.
 * Never returns internal error messages to client callers when status >= 500.
 */
export function apiError(
  message: string,
  code: string,
  status: number,
  details?: unknown
): NextResponse {
  // Never expose internal error messages to client callers when status >= 500
  const safeMessage = status >= 500 ? "Internal server error" : message;

  const body: Record<string, unknown> = { error: safeMessage, code };
  if (details && process.env.NODE_ENV !== "production" && status < 500) {
    body.details = details;
  }

  return NextResponse.json(body, { status });
}

/**
 * Catches unhandled route handler errors, logs them securely on the server,
 * and returns a standard safe 500 error response without exposing internal traces.
 */
export function handleRouteError(
  error: unknown,
  fallbackMessage: string = "Internal server error"
): NextResponse {
  console.error("[Route Error Caught]:", error);
  return apiError(fallbackMessage, "INTERNAL_ERROR", 500);
}

/**
 * Extracts and validates the authenticated user from the request cookies.
 * Returns the user object on success or a 401 NextResponse on failure.
 */
export async function requireUser(): Promise<
  | { user: { id: string; email?: string }; error: null }
  | { user: null; error: NextResponse }
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        user: null,
        error: apiError("Unauthorized", "UNAUTHORIZED", 401),
      };
    }

    return { user, error: null };
  } catch {
    return {
      user: null,
      error: apiError("Unauthorized", "UNAUTHORIZED", 401),
    };
  }
}
