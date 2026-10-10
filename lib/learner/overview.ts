import "server-only";

import { calculateRetentionProbability, buildReviewQueue } from "@/lib/learner/forgetting";
import { calculateEffectiveMastery } from "@/lib/learner/mastery";
import { CURATED_TOPICS } from "@/lib/learner/topics";
import type { PlanItemResult } from "@/lib/learner/engine-v2";

const MIN_ATTEMPTS_FOR_WEAK = 3;

export interface TopicMetric {
  topicId: string;
  topicSlug: string;
  topicName: string;
  difficultyLevel: number;
  masteryScore: number;
  retentionProbability: number;
  effectiveMastery: number;
  halfLifeDays: number;
  attemptsCount: number;
  lastReviewedAt: string;
  misconceptions: Record<string, number>;
  state: "not_started" | "in_progress" | "mastered";
}

export interface DashboardResponse {
  summary: {
    trackedTopics: number;
    assessmentAccuracy: number;
    totalAttempts: number;
    reviewQueueCount: number;
  };
  topicMetrics: TopicMetric[];
  reviewQueue: TopicMetric[];
  weakTopics: TopicMetric[];
  misconceptionCounts: Record<string, number>;
  scoreTrendSeries: Array<{ window: number; accuracy: number }>;
  studyNext: {
    slug: string;
    name: string;
    reason: string;
  };
}

export interface PlanResponse {
  date: string;
  items: PlanItemResult[];
  totalMinutes: number;
}

export interface InsightsResponse {
  strengths: Array<{
    name: string;
    slug: string;
    difficulty: number;
    mastery: number;
    stage: string;
    evidenceCount: number;
    misconceptions: string[];
  }>;
  weaknesses: Array<{
    name: string;
    slug: string;
    difficulty: number;
    mastery: number;
    stage: string;
    evidenceCount: number;
    misconceptions: string[];
  }>;
  concepts: Array<{
    name: string;
    slug: string;
    difficulty: number;
    mastery: number;
    stage: string;
    evidenceCount: number;
    misconceptions: string[];
  }>;
  traits: {
    preferredDepth: string;
    preferredLength: string;
    preferredStyle: string;
    pace: string;
    persistenceScore: number;
    dailyGoalMinutes: number;
    depthDescription: string;
    styleDescription: string;
    paceDescription: string;
  };
  adaptationSummary: string;
}

/**
 * Transforms raw DB states, attempts, and topics into DashboardResponse.
 */
export function computeDashboardData(
  states: any[],
  attempts: any[],
  dbTopics: any[]
): DashboardResponse {
  const topicMetrics: TopicMetric[] = dbTopics.map((top) => {
    const userState = states.find((s) => s.topic_id === top.id);
    const mastery = userState ? Number(userState.mastery_score) : 0.5;
    const halfLife = userState ? Number(userState.half_life_days) : 2.0;
    const attemptsCount = userState ? userState.attempts_count : 0;
    const lastSeenDate = userState?.last_reviewed_at || new Date().toISOString();
    const diffMs = Math.max(0, Date.now() - new Date(lastSeenDate).getTime());
    const daysSince = diffMs / (1000 * 60 * 60 * 24);

    const R = calculateRetentionProbability(daysSince, halfLife);
    const effective = calculateEffectiveMastery(mastery, R);

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
      misconceptions: (userState?.misconceptions as Record<string, number>) || {},
      state,
    };
  });

  const reviewQueue = buildReviewQueue(topicMetrics, new Date(), 5);

  const qualifiedTopics = [...topicMetrics].filter(
    (t) => t.attemptsCount >= MIN_ATTEMPTS_FOR_WEAK
  );
  qualifiedTopics.sort((a, b) => a.effectiveMastery - b.effectiveMastery);
  const weakTopics = qualifiedTopics.slice(0, 3);

  const totalAttempts = attempts.length;
  const correctAttempts = attempts.filter((a) => a.is_correct).length;
  const assessmentAccuracy =
    totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

  const scoreTrendSeries: Array<{ window: number; accuracy: number }> = [];
  if (attempts.length >= 10) {
    const windowSize = 10;
    for (let i = 0; i < Math.min(attempts.length, 100); i += windowSize) {
      const windowAttempts = attempts.slice(i, i + windowSize);
      const windowCorrect = windowAttempts.filter((a) => a.is_correct).length;
      scoreTrendSeries.push({
        window: Math.floor(i / windowSize) + 1,
        accuracy: Math.round((windowCorrect / windowAttempts.length) * 100),
      });
    }
  }

  const misconceptionCounts: Record<string, number> = {};
  for (const t of topicMetrics) {
    for (const [tag, count] of Object.entries(t.misconceptions)) {
      const numCount = Number(count);
      if (numCount > 0) {
        misconceptionCounts[tag] = (misconceptionCounts[tag] || 0) + numCount;
      }
    }
  }

  const studyNext = reviewQueue[0] || weakTopics[0] || topicMetrics[0];

  return {
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
  };
}

/**
 * Computes InsightsResponse from states and traits.
 */
export function computeInsightsData(states: any[], traits: any): InsightsResponse {
  const conceptList = (states || []).map((s) => ({
    name: s.topics?.name || "Concept",
    slug: s.topics?.slug || "concept",
    difficulty: s.topics?.difficulty_level || 2,
    mastery: Number(s.mastery_score),
    stage: s.stage || "unseen",
    evidenceCount: s.evidence_count || 0,
    misconceptions: Object.keys((s.misconceptions as Record<string, unknown>) || {}),
  }));

  const strengths = conceptList.filter(
    (c) => c.stage === "mastered" || c.stage === "proficient"
  );

  const weaknesses = conceptList.filter(
    (c) => c.stage === "exploring" || c.stage === "developing"
  );

  const depthDesc =
    traits?.preferred_depth === "concise"
      ? "Concise high-level summaries"
      : traits?.preferred_depth === "in-depth"
      ? "Rigorous, deep theoretical foundations"
      : "Balanced explanations with practical examples";

  const styleDesc =
    traits?.preferred_style === "code_first"
      ? "Code-first implementation traces"
      : traits?.preferred_style === "steps"
      ? "Step-by-step mechanical algorithmic recipes"
      : "Intuitive real-world analogies";

  const paceDesc =
    traits?.pace === "fast"
      ? "Accelerated pace with concise checks"
      : traits?.pace === "slow"
      ? "Gentle progression with thorough scaffolding"
      : "Steady, moderate progression";

  const adaptationSummary = `LearnAI adapts to you by using ${styleDesc.toLowerCase()} at a ${paceDesc.toLowerCase()}. The tutor emphasizes ${depthDesc.toLowerCase()} and tracks ${weaknesses.length} active learning area${weaknesses.length === 1 ? "" : "s"}.`;

  return {
    strengths,
    weaknesses,
    concepts: conceptList,
    traits: {
      preferredDepth: traits?.preferred_depth || "balanced",
      preferredLength: traits?.preferred_length || "standard",
      preferredStyle: traits?.preferred_style || "analogy",
      pace: traits?.pace || "moderate",
      persistenceScore: traits?.persistence_score ?? 0.5,
      dailyGoalMinutes: traits?.daily_goal_minutes ?? 15,
      depthDescription: depthDesc,
      styleDescription: styleDesc,
      paceDescription: paceDesc,
    },
    adaptationSummary,
  };
}

/**
 * Builds in-memory plan items without DB insert when plan_items are missing.
 */
export function synthesizePlanItems(states: any[]): PlanItemResult[] {
  const plannedItems: Array<Omit<PlanItemResult, "id">> = [];

  const dueReviews = (states || [])
    .map((s) => {
      const daysSince =
        Math.max(0, Date.now() - new Date(s.last_reviewed_at || Date.now()).getTime()) /
        (1000 * 60 * 60 * 24);
      const R = calculateRetentionProbability(daysSince, Number(s.half_life_days || 2));
      return {
        topicId: s.topic_id,
        name: s.topics?.name || "Concept",
        slug: s.topics?.slug || "concept",
        retention: R,
      };
    })
    .filter((r) => r.retention <= 0.70)
    .sort((a, b) => a.retention - b.retention);

  if (dueReviews.length > 0) {
    const topDue = dueReviews[0];
    plannedItems.push({
      type: "review",
      topicId: topDue.topicId,
      conceptName: topDue.name,
      conceptSlug: topDue.slug,
      estMinutes: 5,
      status: "pending",
      reason: `Retention calculated at ${Math.round(topDue.retention * 100)}%. Quick spaced recall keeps this durable.`,
    });
  }

  const developing = (states || []).find(
    (s) => s.stage === "developing" || s.stage === "exploring"
  );
  if (developing && developing.topics?.slug !== plannedItems[0]?.conceptSlug) {
    plannedItems.push({
      type: "practice",
      topicId: developing.topic_id,
      conceptName: developing.topics?.name || "Practice Topic",
      conceptSlug: developing.topics?.slug || "practice",
      estMinutes: 7,
      status: "pending",
      reason: "Currently in active development. Targeted practice will solidify boundary cases.",
    });
  }

  const seenSlugs = new Set((states || []).map((s) => s.topics?.slug).filter(Boolean));
  const nextUnseen = CURATED_TOPICS.find((t) => !seenSlugs.has(t.slug));
  if (nextUnseen) {
    plannedItems.push({
      type: "micro_lesson",
      topicId: null,
      conceptName: nextUnseen.name,
      conceptSlug: nextUnseen.slug,
      estMinutes: 6,
      status: "pending",
      reason: "Next conceptual milestone in your curriculum path.",
    });
  }

  if (plannedItems.length === 0) {
    plannedItems.push({
      type: "micro_lesson",
      topicId: null,
      conceptName: "Arrays & Hashing",
      conceptSlug: "arrays-and-hashing",
      estMinutes: 5,
      status: "pending",
      reason: "Foundational CS building block to kick off your adaptive roadmap.",
    });
  }

  return plannedItems.map((item, idx) => ({
    ...item,
    id: `preview-${idx}-${Date.now()}`,
  }));
}
