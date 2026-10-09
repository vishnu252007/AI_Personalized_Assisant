import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, apiError, handleRouteError } from "@/lib/api-helpers";

export const runtime = "nodejs";

/**
 * DELETE /api/me
 * Permanently purges user account and all cascaded data.
 * Invariant: Requires { confirm: "DELETE" } in request body.
 * Calls admin.auth.admin.deleteUser which cascades across all foreign keys.
 */
export async function DELETE(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;
    const user = auth.user;

    // Strict confirmation check
    const body = await request.json().catch(() => ({}));
    if (!body || body.confirm !== "DELETE") {
      return apiError(
        "Confirmation required: request body must contain { confirm: 'DELETE' }",
        "CONFIRMATION_REQUIRED",
        400
      );
    }

    const admin = createAdminClient();

    // Cascades across profiles, conversations, messages, quizzes, attempts, etc.
    const { error: deleteUserError } =
      await admin.auth.admin.deleteUser(user.id);

    if (deleteUserError) {
      console.error(
        "[DELETE /api/me] Failed to delete auth user:",
        deleteUserError
      );
      return apiError(
        "Failed to delete user account",
        "AUTH_DELETE_ERROR",
        500
      );
    }

    return Response.json({
      success: true,
      message: "All learner data and account have been permanently removed.",
    });
  } catch (error: unknown) {
    return handleRouteError(error, "Failed to delete user account");
  }
}
