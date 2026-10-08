import { createClient } from "@/lib/supabase/server";
import { calculateRetentionProbability, buildReviewQueue } from "@/lib/learner/forgetting";
import { calculateEffectiveMastery } from "@/lib/learner/mastery";
import { requireUser, apiError } from "@/lib/api-helpers";

export const runtime = "nodejs";

/** Minimum attempts required before a topic qualifies as "weak". */
const MIN_ATTEMPTS_FOR_WEAK = 3;

export async function GET() {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;
    const user = auth.user;

    const supabase = await createClient();

    // 1. Fetch learner topic states and user attempts concurrently
    const [statesRes, attemptsRes, topicsRes] = await Promise.all([
      supabase
        .from("learner_topic_state")
        .select(
          "topic_id, mastery_score, half_life_days, attempts_count, last_reviewed_at, misconceptions, topics(id, slug, name, difficulty_level)"
        )
        .eq("user_id", user.id),
      supabase
        .from("attempts")
        .select("is_correct, response_time_ms, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("topics").select("id, slug, name, difficulty_level"),
    ]);

    const states = statesRes.data || [];
    const attempts = attemptsRes.data || [];
    const dbTopics = topicsRes.data || [];

    // Map all topics, blending with user state if present
    const topicMetrics = dbTopics.map(
      (top: {
        id: string;
        slug: string;
        name: string;
        difficulty_level: number;
      }) => {
        const userState = states.find(
          (s: { topic_id: string }) => s.topic_id === top.id
        );
        const mastery = userState ? Number(userState.mastery_score) : 0.5;
        const halfLife = userState ? Number(userState.half_life_days) : 2.0;
        const attemptsCount = userState ? userState.attempts_count : 0;
        const lastSeenDate =
          userState?.last_reviewed_at || new Date().toISOString();
        const diffMs = Math.max(
          0,
          Date.now() - new Date(lastSeenDate).getTime()
        );
        const daysSince = diffMs / (1000 * 60 * 60 * 24);

        const R = calculateRetentionProbability(daysSince, halfLife);
        const effective = calculateEffectiveMastery(mastery, R);

        // Determine state
        let state: "not_started" | "in_progress" | "mastered" = "not_started";
        if (attemptsCount > 0) {
          state = effective >= 0.8 ? "mastered" : "in_progress";
        }

        return {
          topicId: top.id,
          topicSlug: top.slug,
          topicName: top.name,
          difficultyLevel: top.difficulty_level,
          masteryScore: mastery,
          retentionProbability: R,
          effectiveMastery: effective,
          halfLifeDays: halfLife,
          attemptsCount,
          lastReviewedAt: lastSeenDate,
          misconceptions:
            (userState?.misconceptions as Record<string, number>) || {},
          state,
        };
      }
    );

    // 2. Build review queue (R < 0.80, max 5 topics)
    const reviewQueue = buildReviewQueue(topicMetrics, new Date(), 5);

    // 3. Weak topics (lowest effective mastery, minimum attempts required)
    const qualifiedTopics = [...topicMetrics].filter(
      (t) => t.attemptsCount >= MIN_ATTEMPTS_FOR_WEAK
    );
    qualifiedTopics.sort((a, b) => a.effectiveMastery - b.effectiveMastery);
    const weakTopics = qualifiedTopics.slice(0, 3);

    // 4. Overall accuracy and score trend from attempts
    const totalAttempts = attempts.length;
    const correctAttempts = attempts.filter(
      (a: { is_correct: boolean }) => a.is_correct
    ).length;
    const assessmentAccuracy =
      totalAttempts > 0
        ? Math.round((correctAttempts / totalAttempts) * 100)
        : 0;

    // Score trend: group last 100 attempts into windows of 10 for a series
    const scoreTrendSeries: Array<{ window: number; accuracy: number }> = [];
    if (attempts.length >= 10) {
      const windowSize = 10;
      for (
        let i = 0;
        i < Math.min(attempts.length, 100);
        i += windowSize
      ) {
        const windowAttempts = attempts.slice(i, i + windowSize);
        const windowCorrect = windowAttempts.filter(
          (a: { is_correct: boolean }) => a.is_correct
        ).length;
        scoreTrendSeries.push({
          window: Math.floor(i / windowSize) + 1,
          accuracy: Math.round((windowCorrect / windowAttempts.length) * 100),
        });
      }
    }

    // 5. Aggregate all misconceptions across topics — drop zero-count
    const misconceptionCounts: Record<string, number> = {};
    for (const t of topicMetrics) {
      for (const [tag, count] of Object.entries(t.misconceptions)) {
        const numCount = count as number;
        if (numCount > 0) {
          misconceptionCounts[tag] =
            (misconceptionCounts[tag] || 0) + numCount;
        }
      }
    }

    // 6. Determine "Study Next" topic recommendation
    const studyNext =
      reviewQueue[0] || weakTopics[0] || topicMetrics[0];

    return Response.json({
      summary: {
        trackedTopics: topicMetrics.length,
        assessmentAccuracy,
        totalAttempts,
        reviewQueueCount: reviewQueue.length,
      },
      topicMetrics,
      reviewQueue,
      weakTopics,
      misconceptionCounts,
      scoreTrendSeries,
      studyNext: {
        slug: studyNext?.topicSlug || "arrays-and-hashing",
        name: studyNext?.topicName || "Arrays & Hashing",
        reason:
          reviewQueue.length > 0
            ? "Memory retention below 80% — due for review"
            : "Targeting lowest mastery concept",
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[GET /api/dashboard Error]:", err);
    return apiError("Failed to fetch dashboard data", "INTERNAL_ERROR", 500);
  }
}
