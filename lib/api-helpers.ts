import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Standard API error response.
 * In production, the message is replaced with a generic string to avoid leaking internals.
 */
export function apiError(
  message: string,
  code: string,
  status: number,
  details?: unknown
): NextResponse {
  const isProduction = process.env.NODE_ENV === "production";
  const safeMessage = isProduction && status >= 500 ? "Internal server error" : message;

  const body: Record<string, unknown> = { error: safeMessage, code };
  if (details && !isProduction) {
    body.details = details;
  }

  return NextResponse.json(body, { status });
}

/**
 * Extracts and validates the authenticated user from the request.
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
