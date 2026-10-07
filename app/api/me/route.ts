import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * DELETE /api/me
 * Supports the privacy guarantee in settings by purging all personal user data:
 * learner states, style stats, quizzes, conversations, and profile.
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const admin = createAdminClient();

    // Delete all user data in parallel
    await Promise.all([
      admin.from("learner_topic_state").delete().eq("user_id", user.id),
      admin.from("style_stats").delete().eq("user_id", user.id),
      admin.from("quizzes").delete().eq("user_id", user.id),
      admin.from("conversations").delete().eq("user_id", user.id),
      admin.from("profiles").delete().eq("id", user.id),
    ]);

    return NextResponse.json({
      success: true,
      message: "All learner data has been permanently removed.",
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[DELETE /api/me Error]:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to delete user data", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
