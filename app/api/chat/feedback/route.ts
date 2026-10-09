import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, apiError, handleRouteError } from "@/lib/api-helpers";
import { applyLearningEvent } from "@/lib/learner/engine-v2";

export const runtime = "nodejs";

const feedbackSchema = z.object({
  conversationId: z.string().uuid().optional(),
  conceptSlug: z.string().optional(),
  type: z.enum(["thumbs_up", "thumbs_down", "too_easy", "too_hard", "unclear"]),
});

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;
    const user = auth.user;

    const body = await request.json().catch(() => ({}));
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid feedback payload", "VALIDATION_ERROR", 400);
    }

    const { conversationId, conceptSlug, type } = parsed.data;
    const admin = createAdminClient();

    let topicId: string | null = null;
    if (conceptSlug) {
      const { data: topic } = await admin
        .from("topics")
        .select("id")
        .eq("slug", conceptSlug)
        .maybeSingle();
      topicId = topic?.id || null;
    }

    const isPositive = type === "thumbs_up" || type === "too_easy";

    // Apply learning event (weight: 0.04)
    await applyLearningEvent(admin, {
      userId: user.id,
      eventType: "explanation_feedback",
      topicId,
      conceptSlug: conceptSlug || null,
      conversationId: conversationId || null,
      payload: { feedbackType: type, success: isPositive },
      weight: 0.04,
    });

    return Response.json({ success: true, recorded: type });
  } catch (error: unknown) {
    return handleRouteError(error, "Failed to record feedback");
  }
}
