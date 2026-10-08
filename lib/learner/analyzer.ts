import "server-only";

import { getProvider } from "@/lib/ai/provider";
import { analyzerOutputSchema, type AnalyzerOutput } from "@/lib/ai/schemas";
import { buildAnalyzerPrompt } from "@/lib/ai/prompts";
import { CURATED_TOPIC_SLUGS, canonicalizeTopicSlug } from "./topics";
import { calculateNewMastery } from "./mastery";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AnalyzeConversationInput {
  userId: string;
  conversationId: string;
  turns: ConversationTurn[];
  subject?: string;
}

/**
 * Analyzes conversation turns, extracts topic, understanding score, and confusion signals,
 * then updates the learner's Elo mastery state using the service_role admin client.
 * Designed to run in after() background handler.
 */
export async function analyzeConversationTurn(input: AnalyzeConversationInput): Promise<AnalyzerOutput | null> {
  const { userId, conversationId, turns } = input;
  if (!turns || turns.length === 0) return null;

  try {
    const provider = getProvider();
    const prompt = turns.map((t) => `${t.role.toUpperCase()}: ${t.content}`).join("\n\n");
    const systemPrompt = buildAnalyzerPrompt([...CURATED_TOPIC_SLUGS]);

    const result = await provider.generateStructured<AnalyzerOutput>(
      prompt,
      analyzerOutputSchema,
      systemPrompt
    );

    // Canonicalize topic strictly from curated list
    const canonicalSlug = canonicalizeTopicSlug(result.topicSlug);
    if (canonicalSlug === "other") {
      return result;
    }

    const admin = createAdminClient();

    // 1. Fetch topic ID
    const { data: topic } = await admin
      .from("topics")
      .select("id, name")
      .eq("slug", canonicalSlug)
      .single();

    if (!topic) return result;

    // 2. Fetch or create learner_topic_state
    const { data: existingState } = await admin
      .from("learner_topic_state")
      .select("id, mastery_score, attempts_count, misconceptions")
      .eq("user_id", userId)
      .eq("topic_id", topic.id)
      .maybeSingle();

    const currentMastery = existingState ? Number(existingState.mastery_score) : 0.5;
    const attemptsCount = existingState ? existingState.attempts_count : 0;
    const existingMisconceptions = (existingState?.misconceptions as Record<string, number>) || {};

    // 3. Compute new mastery with K_base = 0.05 for chat observations
    const newMastery = calculateNewMastery({
      currentMastery,
      difficulty: result.difficulty,
      outcome: result.understood, // 0.0 to 1.0 understood probability passed through Elo
      attemptsCount,
      isQuizAttempt: false, // chat observation weighting
    });

    // 4. Update misconceptions count map
    const updatedMisconceptions = { ...existingMisconceptions };
    for (const signal of result.confusionSignals || []) {
      const cleanTag = signal.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
      if (cleanTag) {
        updatedMisconceptions[cleanTag] = (updatedMisconceptions[cleanTag] || 0) + 1;
      }
    }

    // 5. Update learner_topic_state without modifying last_reviewed_at on chat
    if (existingState) {
      await admin
        .from("learner_topic_state")
        .update({
          mastery_score: newMastery,
          misconceptions: updatedMisconceptions,
        })
        .eq("id", existingState.id);
    } else {
      await admin.from("learner_topic_state").insert({
        user_id: userId,
        topic_id: topic.id,
        mastery_score: newMastery,
        misconceptions: updatedMisconceptions,
      });
    }

    // 6. Record topic on the conversation for pedagogical style attribution
    await admin
      .from("conversations")
      .update({ topic_id: topic.id })
      .eq("id", conversationId);

    return result;
  } catch (error) {
    console.error("[LearnAI Analyzer] Error analyzing conversation turns:", error);
    return null;
  }
}
