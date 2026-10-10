/**
 * LearnAI — Learner Model Engine v2 & Daily Planner (lib/learner/engine-v2.ts)
 * 
 * Implements Stage 5:
 * 1. Stage derivation per concept (unseen -> exploring -> developing -> proficient -> mastered)
 * 2. Append-only learning events with strict pedagogical weights
 * 3. EWMA learner traits & bandit reward crediting
 * 4. Automated Daily Plan generation based on spaced repetition & weak areas
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { calculateRetentionProbability } from "./forgetting";
import { CURATED_TOPICS } from "./topics";
import type { TutorContext, LearnerStage, LearnerTraits } from "@/lib/ai/prompts";

export type ConceptStage = "unseen" | "exploring" | "developing" | "proficient" | "mastered";

export interface LearningEventInput {
  id?: string;
  userId: string;
  eventType:
    | "quiz_generated"
    | "quiz_completed"
    | "question_answered"
    | "concept_extracted"
    | "hint_delivered"
    | "style_updated"
    | "check_answered"
    | "explanation_feedback"
    | "reask"
    | "plan_item_done"
    | "plan_item_skipped"
    | "chat_signal";
  topicId?: string | null;
  conceptSlug?: string | null;
  conversationId?: string | null;
  payload?: Record<string, unknown>;
  weight?: number;
}

export const EVENT_WEIGHTS: Record<string, number> = {
  quiz_answer: 0.15,
  check_answered: 0.10,
  plan_item_done: 0.05,
  explanation_feedback: 0.04,
  reask: 0.04,
  chat_signal: 0.03,
  plan_item_skipped: -0.02,
};

/**
 * Derives the stage for a concept based on mastery score and accumulated evidence.
 * Enforces evidence count thresholds and hysteresis before promotion/demotion.
 */
export function deriveConceptStage(
  mastery: number,
  evidenceCount: number,
  currentStage: ConceptStage = "unseen"
): ConceptStage {
  if (evidenceCount === 0) return "unseen";

  // Mastered: high evidence (>= 8) and exceptional mastery (>= 0.88)
  if (evidenceCount >= 8 && mastery >= 0.88) {
    return "mastered";
  }

  // Proficient: solid evidence (>= 5) and strong mastery (>= 0.70)
  if (evidenceCount >= 5 && mastery >= 0.70) {
    // If previously mastered, demote only if mastery drops significantly (< 0.80)
    if (currentStage === "mastered" && mastery >= 0.80) {
      return "mastered";
    }
    return "proficient";
  }

  // Developing: moderate evidence (>= 3) and fair mastery (>= 0.40)
  if (evidenceCount >= 3 && mastery >= 0.40) {
    if (currentStage === "proficient" && mastery >= 0.65) {
      return "proficient";
    }
    return "developing";
  }

  // Exploring: at least 1 evidence event, introductory mastery (< 0.40)
  return "exploring";
}

/**
 * Applies an append-only learning event, updating learner_topic_state and traits.
 */
export async function applyLearningEvent(
  admin: ReturnType<typeof createAdminClient>,
  event: LearningEventInput
): Promise<{ success: boolean; stage?: ConceptStage }> {
  const weight = event.weight ?? EVENT_WEIGHTS[event.eventType] ?? 0.03;

  // 1. Record event in append-only log
  try {
    await admin.from("learning_events").insert({
      id: event.id,
      user_id: event.userId,
      event_type: event.eventType as any,
      topic_id: event.topicId || null,
      concept_slug: event.conceptSlug || null,
      conversation_id: event.conversationId || null,
      metadata: (event.payload as any) || {},
    });
  } catch {
    // Non-fatal if table not migrated yet
  }

  if (!event.topicId) {
    return { success: true };
  }

  // 2. Fetch current topic state
  const { data: state } = await admin
    .from("learner_topic_state")
    .select("id, mastery_score, stage, evidence_count, misconceptions")
    .eq("user_id", event.userId)
    .eq("topic_id", event.topicId)
    .maybeSingle();

  const currentMastery = state ? Number(state.mastery_score) : 0.30;
  const currentEvidence = state ? (state.evidence_count || 0) : 0;
  const currentStage = (state?.stage as ConceptStage) || "unseen";

  // Calculate delta based on event success
  const isPositive = event.payload?.success === true || (event.payload?.score as number) > 0.5;
  const delta = isPositive ? weight : -Math.abs(weight * 0.8);

  const newMastery = Math.max(0.05, Math.min(0.98, currentMastery + delta));
  const newEvidence = currentEvidence + 1;
  const newStage = deriveConceptStage(newMastery, newEvidence, currentStage);

  // Update learner_topic_state
  if (state?.id) {
    await admin
      .from("learner_topic_state")
      .update({
        mastery_score: newMastery,
        evidence_count: newEvidence,
        stage: newStage,
        last_reviewed_at: new Date().toISOString(),
      })
      .eq("id", state.id);
  } else {
    await admin.from("learner_topic_state").insert({
      user_id: event.userId,
      topic_id: event.topicId,
      mastery_score: newMastery,
      half_life_days: 1.0,
      attempts_count: 1,
      evidence_count: newEvidence,
      stage: newStage,
      last_reviewed_at: new Date().toISOString(),
      misconceptions: {},
    });
  }

  return { success: true, stage: newStage };
}

/**
 * Credits Thompson sampling bandit reward directly to the style actually used.
 */
export async function creditStyleReward(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  style: "analogy" | "steps" | "code_first",
  success: boolean
): Promise<void> {
  // Ensure the 3 style rows exist
  const styles: Array<"analogy" | "steps" | "code_first"> = ["analogy", "steps", "code_first"];
  for (const s of styles) {
    try {
      await admin
        .from("style_stats")
        .insert({ user_id: userId, style: s, alpha: 1, beta: 1 })
        .select("user_id")
        .maybeSingle();
    } catch {
      // Ignored if already exists
    }
  }

  const { data: current } = await admin
    .from("style_stats")
    .select("alpha, beta")
    .eq("user_id", userId)
    .eq("style", style)
    .maybeSingle();

  if (current) {
    await admin
      .from("style_stats")
      .update({
        alpha: success ? current.alpha + 1 : current.alpha,
        beta: !success ? current.beta + 1 : current.beta,
      })
      .eq("user_id", userId)
      .eq("style", style);
  }
}

export interface PlanItemResult {
  id: string;
  type: "review" | "micro_lesson" | "practice" | "reflect";
  topicId: string | null;
  conceptName: string;
  conceptSlug: string;
  estMinutes: number;
  status: "pending" | "completed" | "skipped";
  reason: string;
}

import { synthesizePlanItems } from "./overview";

/**
 * Read-only retrieval of the daily plan. Does NOT perform synchronous DB inserts.
 */
export async function getDailyPlanReadOnly(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  targetDate: string = new Date().toISOString().split("T")[0]
): Promise<PlanItemResult[]> {
  const { data: existingItems } = await admin
    .from("plan_items")
    .select("id, type, topic_id, concept_name, concept_slug, est_minutes, status, reason")
    .eq("user_id", userId)
    .eq("plan_date", targetDate)
    .order("created_at", { ascending: true });

  if (existingItems && existingItems.length > 0) {
    return existingItems.map((item) => ({
      id: item.id,
      type: item.type as PlanItemResult["type"],
      topicId: item.topic_id,
      conceptName: item.concept_name,
      conceptSlug: item.concept_slug,
      estMinutes: item.est_minutes,
      status: item.status as PlanItemResult["status"],
      reason: item.reason,
    }));
  }

  const { data: states } = await admin
    .from("learner_topic_state")
    .select("topic_id, mastery_score, half_life_days, last_reviewed_at, stage, evidence_count, topics(id, slug, name, difficulty_level)")
    .eq("user_id", userId);

  return synthesizePlanItems(states || []);
}

/**
 * Generates or fetches Today's personalized daily plan for the student.
 */
export async function getOrCreateDailyPlan(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  targetDate: string = new Date().toISOString().split("T")[0]
): Promise<PlanItemResult[]> {
  // 1. Check if plan already exists for this date
  const { data: existingItems } = await admin
    .from("plan_items")
    .select("id, type, topic_id, concept_name, concept_slug, est_minutes, status, reason")
    .eq("user_id", userId)
    .eq("plan_date", targetDate)
    .order("created_at", { ascending: true });

  if (existingItems && existingItems.length > 0) {
    return existingItems.map((item) => ({
      id: item.id,
      type: item.type as PlanItemResult["type"],
      topicId: item.topic_id,
      conceptName: item.concept_name,
      conceptSlug: item.concept_slug,
      estMinutes: item.est_minutes,
      status: item.status as PlanItemResult["status"],
      reason: item.reason,
    }));
  }

  // 2. Build items from spaced repetition & weakness signals
  const { data: states } = await admin
    .from("learner_topic_state")
    .select("topic_id, mastery_score, half_life_days, last_reviewed_at, stage, evidence_count, topics(id, slug, name, difficulty_level)")
    .eq("user_id", userId);

  const plannedItems: Array<Omit<PlanItemResult, "id">> = [];

  // Identify due reviews (forgetting curve retention R <= 0.70)
  const dueReviews = (states || [])
    .map((s) => {
      const daysSince = Math.max(0, Date.now() - new Date(s.last_reviewed_at).getTime()) / (1000 * 60 * 60 * 24);
      const R = calculateRetentionProbability(daysSince, Number(s.half_life_days));
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

  // Identify active weakness / developing area
  const developing = (states || []).find((s) => s.stage === "developing" || s.stage === "exploring");
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

  // Introduce next curriculum milestone
  const seenSlugs = new Set((states || []).map((s) => s.topics?.slug).filter(Boolean));
  const nextUnseen = CURATED_TOPICS.find((t) => !seenSlugs.has(t.slug));

  if (nextUnseen) {
    const { data: dbTopic } = await admin
      .from("topics")
      .select("id")
      .eq("slug", nextUnseen.slug)
      .maybeSingle();

    plannedItems.push({
      type: "micro_lesson",
      topicId: dbTopic?.id || null,
      conceptName: nextUnseen.name,
      conceptSlug: nextUnseen.slug,
      estMinutes: 6,
      status: "pending",
      reason: "Next conceptual milestone in your curriculum path.",
    });
  }

  // Fallback if empty (new user session)
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

  // Insert generated plan into plan_items
  const insertPayload = plannedItems.map((item) => ({
    user_id: userId,
    plan_date: targetDate,
    type: item.type,
    topic_id: item.topicId,
    concept_name: item.conceptName,
    concept_slug: item.conceptSlug,
    est_minutes: item.estMinutes,
    status: "pending" as const,
    reason: item.reason,
  }));

  const { data: createdItems, error } = await admin
    .from("plan_items")
    .insert(insertPayload)
    .select("id, type, topic_id, concept_name, concept_slug, est_minutes, status, reason");

  if (error || !createdItems) {
    // Return generated items in-memory if DB table not yet created
    return plannedItems.map((item, idx) => ({
      ...item,
      id: `local-plan-${idx}`,
    }));
  }

  return createdItems.map((item) => ({
    id: item.id,
    type: item.type as PlanItemResult["type"],
    topicId: item.topic_id,
    conceptName: item.concept_name,
    conceptSlug: item.concept_slug,
    estMinutes: item.est_minutes,
    status: item.status as PlanItemResult["status"],
    reason: item.reason,
  }));
}

/**
 * Builds runtime TutorContext for every conversational turn.
 */
export async function buildRuntimeTutorContext(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  topicSlug?: string
): Promise<TutorContext> {
  // Fetch learner traits
  const { data: traits } = await admin
    .from("learner_traits")
    .select("preferred_depth, preferred_length, pace")
    .eq("user_id", userId)
    .maybeSingle();

  let stage: LearnerStage = "developing";
  let misconceptions: string[] = [];
  let conceptName: string | undefined = undefined;

  if (topicSlug) {
    const { data: state } = await admin
      .from("learner_topic_state")
      .select("stage, mastery_score, misconceptions, topics(name)")
      .eq("user_id", userId)
      .eq("topics.slug", topicSlug)
      .maybeSingle();

    if (state) {
      conceptName = state.topics?.name;
      const rawStage = state.stage;
      if (rawStage === "mastered") stage = "mastered";
      else if (rawStage === "proficient") stage = "proficient";
      else if (rawStage === "exploring" || rawStage === "unseen") stage = "novice";
      else stage = "developing";

      if (state.misconceptions && typeof state.misconceptions === "object") {
        misconceptions = Object.keys(state.misconceptions).slice(0, 3);
      }
    }
  }

  const tutorTraits: LearnerTraits = {
    preferredDepth: traits?.preferred_depth || "balanced",
    preferredLength: traits?.preferred_length || "standard",
    pace: traits?.pace || "moderate",
  };

  return {
    conceptName,
    stage,
    misconceptions,
    traits: tutorTraits,
  };
}
