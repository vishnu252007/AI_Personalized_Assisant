import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, handleRouteError, apiError } from "@/lib/api-helpers";
import { getOrCreateDailyPlan } from "@/lib/learner/engine-v2";
import { z } from "zod";

export const runtime = "nodejs";

const AddPlanItemSchema = z.object({
  type: z
    .enum(["review", "micro_lesson", "practice", "reflect"])
    .default("practice"),
  conceptName: z.string().min(1).max(200),
  conceptSlug: z.string().min(1).max(200),
  estMinutes: z.number().int().min(1).max(60).default(5),
  reason: z.string().min(1).max(500),
});

export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;
    const user = auth.user;

    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date") || new Date().toISOString().split("T")[0];

    const admin = createAdminClient();
    const planItems = await getOrCreateDailyPlan(admin, user.id, dateParam);

    return Response.json({
      date: dateParam,
      items: planItems,
      totalMinutes: planItems.reduce((acc, i) => acc + i.estMinutes, 0),
    });
  } catch (error: unknown) {
    return handleRouteError(error, "Failed to retrieve daily plan");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;
    const user = auth.user;

    const body = await request.json();
    const parsed = AddPlanItemSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.message, "VALIDATION_ERROR", 400);
    }

    const admin = createAdminClient();
    const today = new Date().toISOString().split("T")[0];

    const { data: dbTopic } = await admin
      .from("topics")
      .select("id")
      .eq("slug", parsed.data.conceptSlug)
      .maybeSingle();

    const { data: item, error } = await admin
      .from("plan_items")
      .insert({
        user_id: user.id,
        plan_date: today,
        type: parsed.data.type,
        topic_id: dbTopic?.id || null,
        concept_name: parsed.data.conceptName,
        concept_slug: parsed.data.conceptSlug,
        est_minutes: parsed.data.estMinutes,
        status: "pending",
        reason: parsed.data.reason,
      })
      .select("id, type, topic_id, concept_name, concept_slug, est_minutes, status, reason")
      .single();

    if (error || !item) {
      // In-memory fallback if database table not yet migrated
      return Response.json({
        item: {
          id: `local-plan-${Date.now()}`,
          type: parsed.data.type,
          conceptName: parsed.data.conceptName,
          conceptSlug: parsed.data.conceptSlug,
          estMinutes: parsed.data.estMinutes,
          status: "pending",
          reason: parsed.data.reason,
        },
      });
    }

    return Response.json({ item }, { status: 201 });
  } catch (error: unknown) {
    return handleRouteError(error, "Failed to add item to daily plan");
  }
}
