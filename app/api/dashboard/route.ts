import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateRetentionProbability, buildReviewQueue } from "@/lib/learner/forgetting";
import { calculateEffectiveMastery } from "@/lib/learner/mastery";

export const runtime = "nodejs";

export async function GET() {
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

    // 1. Fetch learner topic states and user attempts concurrently
    const [statesRes, attemptsRes, topicsRes] = await Promise.all([
      supabase
        .from("learner_topic_state")
        .select("topic_id, mastery_score, half_life_days, attempts_count, last_reviewed_at, misconceptions, topics(id, slug, name, difficulty_level)")
        .eq("user_id", user.id),
      supabase
        .from("attempts")
        .select("is_correct, response_time_ms, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("topics")
        .select("id, slug, name, difficulty_level"),
    ]);

    const states = statesRes.data || [];
    const attempts = attemptsRes.data || [];
    const dbTopics = topicsRes.data || [];

    // Map all topics, blending with user state if present
    const topicMetrics = dbTopics.map((top: { id: string; slug: string; name: string; difficulty_level: number }) => {
      const userState = states.find((s: { topic_id: string }) => s.topic_id === top.id);
      const mastery = userState ? Number(userState.mastery_score) : 0.5;
      const halfLife = userState ? Number(userState.half_life_days) : 2.0;
      const lastSeenDate = userState?.last_reviewed_at || new Date().toISOString();
      const diffMs = Math.max(0, Date.now() - new Date(lastSeenDate).getTime());
      const daysSince = diffMs / (1000 * 60 * 60 * 24);

      const R = calculateRetentionProbability(daysSince, halfLife);
      const effective = calculateEffectiveMastery(mastery, R);

      return {
        topicId: top.id,
        topicSlug: top.slug,
        topicName: top.name,
        difficultyLevel: top.difficulty_level,
        masteryScore: mastery,
        retentionProbability: R,
        effectiveMastery: effective,
        halfLifeDays: halfLife,
        attemptsCount: userState ? userState.attempts_count : 0,
        lastReviewedAt: lastSeenDate,
        misconceptions: (userState?.misconceptions as Record<string, number>) || {},
      };
    });

    // 2. Build review queue (R < 0.80, max 5 topics)
    const reviewQueue = buildReviewQueue(topicMetrics, new Date(), 5);

    // 3. Weak topics (lowest effective mastery)
    const sortedByMastery = [...topicMetrics].sort((a, b) => a.effectiveMastery - b.effectiveMastery);
    const weakTopics = sortedByMastery.slice(0, 3);

    // 4. Overall accuracy and trend from attempts
    const totalAttempts = attempts.length;
    const correctAttempts = attempts.filter((a: { is_correct: boolean }) => a.is_correct).length;
    const assessmentAccuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

    // Aggregate all misconceptions across topics
    const misconceptionCounts: Record<string, number> = {};
    for (const t of topicMetrics) {
      for (const [tag, count] of Object.entries(t.misconceptions)) {
        misconceptionCounts[tag] = (misconceptionCounts[tag] || 0) + (count as number);
      }
    }

    // 5. Determine "Study Next" topic recommendation
    const studyNext = reviewQueue[0] || weakTopics[0] || topicMetrics[0];

    return NextResponse.json({
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
      studyNext: {
        slug: studyNext?.topicSlug || "arrays-and-hashing",
        name: studyNext?.topicName || "Arrays & Hashing",
        reason: reviewQueue.length > 0 ? "Memory retention below 80% — due for review" : "Targeting lowest mastery concept",
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[GET /api/dashboard Error]:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch dashboard data", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
