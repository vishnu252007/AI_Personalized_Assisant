import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, apiError } from "@/lib/api-helpers";

export const runtime = "nodejs";

/**
 * DELETE /api/me
 * Supports the privacy guarantee in settings by purging all personal user data:
 * learner states, style stats, quizzes, conversations, profile, and the auth account.
 */
export async function DELETE() {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;
    const user = auth.user;

    const admin = createAdminClient();

    // Delete all user data in parallel
    const results = await Promise.allSettled([
      admin.from("learner_topic_state").delete().eq("user_id", user.id),
      admin.from("style_stats").delete().eq("user_id", user.id),
      admin.from("quizzes").delete().eq("user_id", user.id),
      admin.from("conversations").delete().eq("user_id", user.id),
      admin.from("profiles").delete().eq("id", user.id),
    ]);

    // Check for data deletion errors
    const dataErrors = results.filter((r) => r.status === "rejected");
    if (dataErrors.length > 0) {
      console.error("[DELETE /api/me] Data deletion errors:", dataErrors);
    }

    // Delete the auth user account via admin API
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
    const err = error as Error;
    console.error("[DELETE /api/me Error]:", err);
    return apiError("Failed to delete user data", "INTERNAL_ERROR", 500);
  }
}
