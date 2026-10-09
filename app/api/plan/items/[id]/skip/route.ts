import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, apiError, handleRouteError } from "@/lib/api-helpers";
import { applyLearningEvent } from "@/lib/learner/engine-v2";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;
    const user = auth.user;

    const { id: itemId } = await context.params;
    if (!itemId) {
      return apiError("Missing plan item ID", "VALIDATION_ERROR", 400);
    }

    const admin = createAdminClient();

    // Verify ownership and get item
    const { data: item } = await admin
      .from("plan_items")
      .select("id, topic_id, concept_slug")
      .eq("id", itemId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!item) {
      return apiError("Plan item not found", "NOT_FOUND", 404);
    }

    // Mark skipped
    await admin
      .from("plan_items")
      .update({ status: "skipped", updated_at: new Date().toISOString() })
      .eq("id", itemId);

    // Apply learning event (weight: -0.02)
    await applyLearningEvent(admin, {
      userId: user.id,
      eventType: "plan_item_skipped",
      topicId: item.topic_id,
      conceptSlug: item.concept_slug,
      payload: { planItemId: itemId, skipped: true },
      weight: -0.02,
    });

    return Response.json({ success: true, id: itemId, status: "skipped" });
  } catch (error: unknown) {
    return handleRouteError(error, "Failed to skip plan item");
  }
}
