import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, handleRouteError } from "@/lib/api-helpers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;
    const user = auth.user;

    const admin = createAdminClient();

    // 1. Fetch user states
    const { data: states } = await admin
      .from("learner_topic_state")
      .select("topic_id, mastery_score, stage, evidence_count, misconceptions, topics(name, slug, difficulty_level)")
      .eq("user_id", user.id);

    // 2. Fetch traits
    const { data: traits } = await admin
      .from("learner_traits")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

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

    // Human-readable traits description
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

    return Response.json({
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
    });
  } catch (error: unknown) {
    return handleRouteError(error, "Failed to retrieve profile insights");
  }
}
