import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, handleRouteError } from "@/lib/api-helpers";
import {
  computeDashboardData,
  computeInsightsData,
  synthesizePlanItems,
} from "@/lib/learner/overview";
import { getOrCreateDailyPlan } from "@/lib/learner/engine-v2";
import { after } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const tAuthStart = performance.now();
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;
    const user = auth.user;
    const authDur = Math.max(0.1, Math.round((performance.now() - tAuthStart) * 100) / 100);

    const tDbStart = performance.now();
    const admin = createAdminClient();
    const today = new Date().toISOString().split("T")[0];

    // Single consolidated parallel database batch
    const [statesRes, attemptsRes, topicsRes, planItemsRes, traitsRes] =
      await Promise.all([
        admin
          .from("learner_topic_state")
          .select(
            "topic_id, mastery_score, half_life_days, attempts_count, last_reviewed_at, misconceptions, stage, evidence_count, topics(id, slug, name, difficulty_level)"
          )
          .eq("user_id", user.id),
        admin
          .from("attempts")
          .select("is_correct, response_time_ms, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),
        admin.from("topics").select("id, slug, name, difficulty_level"),
        admin
          .from("plan_items")
          .select(
            "id, type, topic_id, concept_name, concept_slug, est_minutes, status, reason"
          )
          .eq("user_id", user.id)
          .eq("plan_date", today)
          .order("created_at", { ascending: true }),
        admin
          .from("learner_traits")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

    const dbDur = Math.max(0.1, Math.round((performance.now() - tDbStart) * 100) / 100);

    const states = statesRes.data || [];
    const attempts = attemptsRes.data || [];
    const dbTopics = topicsRes.data || [];
    const dbPlanItems = planItemsRes.data || [];
    const traits = traitsRes.data || null;

    // 1. Compute dashboard metrics
    const dashboard = computeDashboardData(states, attempts, dbTopics);

    // 2. Compute plan items
    let planItems = dbPlanItems.map((item) => ({
      id: item.id,
      type: item.type as "review" | "micro_lesson" | "practice" | "reflect",
      topicId: item.topic_id,
      conceptName: item.concept_name,
      conceptSlug: item.concept_slug,
      estMinutes: item.est_minutes,
      status: item.status as "pending" | "completed" | "skipped",
      reason: item.reason,
    }));

    if (planItems.length === 0) {
      // Synthesize in-memory items and trigger background creation
      planItems = synthesizePlanItems(states);
      try {
        after(async () => {
          try {
            await getOrCreateDailyPlan(admin, user.id, today);
          } catch {
            // Background worker non-blocking catch
          }
        });
      } catch {
        // after() fallback
      }
    }

    const plan = {
      date: today,
      items: planItems,
      totalMinutes: planItems.reduce((acc, i) => acc + i.estMinutes, 0),
    };

    // 3. Compute insights
    const insights = computeInsightsData(states, traits);

    return Response.json(
      {
        dashboard,
        plan,
        insights,
      },
      {
        headers: {
          "Server-Timing": `auth;dur=${authDur}, db;dur=${dbDur}`,
        },
      }
    );
  } catch (error: unknown) {
    return handleRouteError(error, "Failed to retrieve overview data");
  }
}
