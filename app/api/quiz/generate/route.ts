import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/ai/provider";
import { buildQuizGeneratorPrompt } from "@/lib/ai/prompts";
import {
  quizBatchGenerationSchema,
  generateQuizRequestSchema,
  type QuizQuestionGenerated,
} from "@/lib/ai/schemas";
import { CURATED_TOPICS } from "@/lib/learner/topics";
import {
  calculateRetentionProbability,
  isDueForReview,
} from "@/lib/learner/forgetting";
import { calculateEffectiveMastery } from "@/lib/learner/mastery";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser, apiError, handleRouteError } from "@/lib/api-helpers";
import { getFallbackQuestions } from "@/lib/ai/fallback-questions";
import {
  extractConceptFromConversation,
  ensureTopicExists,
  toConceptSlug,
} from "@/lib/learner/concepts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;
    const user = auth.user;

    // Stricter rate limit: quiz generation is expensive (quizGenerate: 5/min)
    const rateLimit = await checkRateLimit(user.id, "quizGenerate");
    if (!rateLimit.success) {
      return apiError(
        "Rate limit exceeded. Please wait before generating another quiz.",
        "RATE_LIMITED",
        429
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = generateQuizRequestSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "Invalid quiz generation payload",
        "VALIDATION_ERROR",
        400,
        parsed.error.flatten()
      );
    }

    const {
      mode,
      topicSlug: requestedSlug,
      conversationId,
      conceptName: requestedConceptName,
      count: requestedCount,
    } = parsed.data;

    const admin = createAdminClient();

    let targetTopicSlug = requestedSlug || "arrays-and-hashing";
    let targetTopicName = "Arrays & Hashing";
    let targetDifficulty = 2;
    let questionCount = requestedCount || 4;
    let topMisconceptions: string[] = [];
    let topicId: string | null = null;

    if (mode === "chat" || conversationId) {
      // -------------------------------------------------------------
      // Chat-Driven Quiz Mode
      // Extract target concept and misconceptions from active conversation
      // -------------------------------------------------------------
      questionCount = requestedCount || 3;

      let convMessages: { role: string; content: string }[] = [];
      if (conversationId) {
        const { data: dbMessages } = await admin
          .from("messages")
          .select("role, content")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true })
          .limit(20);

        convMessages = dbMessages || [];
      }

      if (convMessages.length > 0) {
        const extracted = await extractConceptFromConversation(convMessages);
        targetTopicSlug = extracted.conceptSlug;
        targetTopicName = requestedConceptName || extracted.conceptName;
        targetDifficulty = extracted.difficulty;
        topMisconceptions = extracted.misconceptions;
      } else if (requestedConceptName) {
        targetTopicName = requestedConceptName;
        targetTopicSlug = toConceptSlug(requestedConceptName);
      }

      // Ensure open concept exists dynamically in public.topics
      const topicRecord = await ensureTopicExists(admin, {
        name: targetTopicName,
        slug: targetTopicSlug,
        difficultyLevel: targetDifficulty,
      });

      topicId = topicRecord.id;
      targetTopicSlug = topicRecord.slug;
      targetTopicName = topicRecord.name;
    } else if (mode === "diagnostic") {
      // -------------------------------------------------------------
      // Diagnostic Mode: 7 questions across core topics
      // -------------------------------------------------------------
      questionCount = requestedCount || 7;

      const { data: states } = await admin
        .from("learner_topic_state")
        .select("topics(slug)")
        .eq("user_id", user.id);

      const seenSlugs = new Set(
        (states || [])
          .map((s: { topics?: { slug: string } | null }) => s.topics?.slug)
          .filter(Boolean) as string[]
      );

      const unseenTopics = CURATED_TOPICS.filter((t) => !seenSlugs.has(t.slug));
      const firstUnseen = unseenTopics[0];
      targetTopicSlug = firstUnseen?.slug || "arrays-and-hashing";
      const match = CURATED_TOPICS.find((t) => t.slug === targetTopicSlug);
      targetTopicName = match?.name || "Arrays & Hashing";
      targetDifficulty = 2;

      const topicRecord = await ensureTopicExists(admin, {
        name: targetTopicName,
        slug: targetTopicSlug,
        difficultyLevel: targetDifficulty,
      });
      topicId = topicRecord.id;
    } else if (mode === "topic" && requestedSlug) {
      // -------------------------------------------------------------
      // Topic Mode: Curated or open concept
      // -------------------------------------------------------------
      questionCount = requestedCount || 4;
      const match = CURATED_TOPICS.find((t) => t.slug === requestedSlug);

      if (match) {
        targetTopicSlug = match.slug;
        targetTopicName = match.name;
        targetDifficulty = match.difficultyLevel;
      } else {
        targetTopicSlug = toConceptSlug(requestedSlug);
        targetTopicName =
          requestedConceptName ||
          requestedSlug
            .replace(/-/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
        targetDifficulty = 2;
      }

      const topicRecord = await ensureTopicExists(admin, {
        name: targetTopicName,
        slug: targetTopicSlug,
        difficultyLevel: targetDifficulty,
      });
      topicId = topicRecord.id;
    } else {
      // -------------------------------------------------------------
      // Recommended Mode: Spaced repetition retention & mastery
      // -------------------------------------------------------------
      questionCount = requestedCount || 4;

      const { data: states } = await admin
        .from("learner_topic_state")
        .select(
          "topic_id, mastery_score, half_life_days, last_reviewed_at, misconceptions, topics(id, slug, name, difficulty_level)"
        )
        .eq("user_id", user.id);

      const seenSlugs = new Set(
        (states || [])
          .map((s: { topics?: { slug: string } | null }) => s.topics?.slug)
          .filter(Boolean) as string[]
      );

      const evaluated = (states || []).map((s) => {
        const diffMs = Math.max(
          0,
          Date.now() - new Date(s.last_reviewed_at).getTime()
        );
        const daysSince = diffMs / (1000 * 60 * 60 * 24);
        const R = calculateRetentionProbability(
          daysSince,
          Number(s.half_life_days)
        );
        const effective = calculateEffectiveMastery(
          Number(s.mastery_score),
          R
        );
        return {
          slug: s.topics?.slug,
          name: s.topics?.name,
          difficulty: s.topics?.difficulty_level || 2,
          isDue: isDueForReview(R),
          effectiveMastery: effective,
          retentionProbability: R,
          mastery: Number(s.mastery_score),
          misconceptions: (s.misconceptions as Record<string, number>) || {},
        };
      });

      // Priority 1: lowest retention (due for review)
      const dueTopics = evaluated
        .filter((e) => e.isDue && e.slug)
        .sort((a, b) => a.retentionProbability - b.retentionProbability);

      if (dueTopics.length > 0 && dueTopics[0].slug) {
        targetTopicSlug = dueTopics[0].slug;
        targetTopicName = dueTopics[0].name || targetTopicSlug;
        targetDifficulty = Math.max(
          1,
          Math.min(5, Math.round(dueTopics[0].mastery * 5))
        );
        topMisconceptions = Object.entries(dueTopics[0].misconceptions)
          .sort((a, b) => (b[1] as number) - (a[1] as number))
          .slice(0, 3)
          .map(([tag]) => tag);
      } else if (evaluated.length > 0) {
        const unseenTopics = CURATED_TOPICS.filter(
          (t) => !seenSlugs.has(t.slug)
        );
        if (unseenTopics.length > 0) {
          targetTopicSlug = unseenTopics[0].slug;
          targetTopicName = unseenTopics[0].name;
          targetDifficulty = unseenTopics[0].difficultyLevel;
        } else {
          evaluated.sort((a, b) => a.effectiveMastery - b.effectiveMastery);
          targetTopicSlug = evaluated[0].slug || "arrays-and-hashing";
          targetTopicName = evaluated[0].name || "Arrays & Hashing";
          targetDifficulty = Math.max(
            1,
            Math.min(5, Math.round(evaluated[0].mastery * 5))
          );
          topMisconceptions = Object.entries(evaluated[0].misconceptions)
            .sort((a, b) => (b[1] as number) - (a[1] as number))
            .slice(0, 3)
            .map(([tag]) => tag);
        }
      } else {
        targetTopicSlug = "arrays-and-hashing";
        targetTopicName = "Arrays & Hashing";
        targetDifficulty = 1;
      }

      const topicRecord = await ensureTopicExists(admin, {
        name: targetTopicName,
        slug: targetTopicSlug,
        difficultyLevel: targetDifficulty,
      });
      topicId = topicRecord.id;
    }

    // 2. Generate questions with AI Provider, with fallback question bank
    let questions: QuizQuestionGenerated[];

    try {
      const provider = getProvider();
      const prompt = buildQuizGeneratorPrompt(
        targetTopicName,
        targetDifficulty,
        questionCount,
        topMisconceptions
      );

      const generated = await provider.generateStructured(
        prompt,
        quizBatchGenerationSchema
      );
      questions = generated.questions;
    } catch (aiErr) {
      console.error(
        "[Quiz Generate] AI generation failed, using fallback bank:",
        aiErr
      );
      const fallback = getFallbackQuestions(targetTopicSlug, questionCount);
      questions = fallback;
    }

    if (questions.length === 0) {
      return apiError(
        "Failed to generate quiz questions",
        "GENERATION_FAILED",
        500
      );
    }

    // 3. Insert Quiz + Questions + Keys in a batch with graceful schema handling
    const baseQuizPayload = {
      user_id: user.id,
      topic_id: topicId,
      difficulty_level: targetDifficulty,
      status: "in_progress" as const,
      total_questions: questions.length,
    };

    let { data: quiz, error: quizError } = await admin
      .from("quizzes")
      .insert({
        ...baseQuizPayload,
        conversation_id: conversationId || null,
        concept_slug: targetTopicSlug,
      })
      .select("id, status, difficulty_level, total_questions, created_at")
      .single();

    // Fallback if migration 003 hasn't run yet in remote database (missing columns)
    if (quizError && (quizError.code === "42703" || quizError.message?.includes("column"))) {
      const retry = await admin
        .from("quizzes")
        .insert(baseQuizPayload)
        .select("id, status, difficulty_level, total_questions, created_at")
        .single();

      quiz = retry.data;
      quizError = retry.error;
    }

    if (quizError || !quiz) {
      return apiError(
        "Failed to persist quiz record",
        "DATABASE_ERROR",
        500
      );
    }

    // Batch insert questions
    const questionInserts = questions.map((q, i) => ({
      quiz_id: quiz.id,
      topic_id: topicId,
      difficulty: q.difficulty,
      question_text: q.questionText,
      options: q.options,
      order_index: i,
    }));

    const { data: insertedQuestions, error: batchQErr } = await admin
      .from("questions")
      .insert(questionInserts)
      .select("id, question_text, options, difficulty, order_index");

    if (batchQErr || !insertedQuestions || insertedQuestions.length === 0) {
      // Rollback
      await admin.from("quizzes").delete().eq("id", quiz.id);
      return apiError(
        "Failed to insert quiz questions",
        "DATABASE_ERROR",
        500
      );
    }

    // Batch insert question keys
    const keyInserts = insertedQuestions.map((iq, i) => ({
      question_id: iq.id,
      correct_index: questions[i].correctIndex,
      rationales: questions[i].rationales,
      misconception_tags: questions[i].misconceptionTags,
    }));

    const { error: batchKeyErr } = await admin
      .from("question_keys")
      .insert(keyInserts);

    if (batchKeyErr) {
      // Rollback
      await admin.from("questions").delete().eq("quiz_id", quiz.id);
      await admin.from("quizzes").delete().eq("id", quiz.id);
      return apiError(
        "Failed to insert question keys",
        "DATABASE_ERROR",
        500
      );
    }

    // Non-blocking learning event logging
    Promise.resolve(
      admin
        .from("learning_events")
        .insert({
          user_id: user.id,
          event_type: "quiz_generated",
          topic_id: topicId,
          conversation_id: conversationId || null,
          concept_slug: targetTopicSlug,
          metadata: {
            mode,
            question_count: questions.length,
            difficulty: targetDifficulty,
          },
        })
    ).catch(() => {});

    // Strip secrets from client payload (no answers or keys exposed)
    const clientQuestions = insertedQuestions.map((iq) => ({
      id: iq.id,
      questionText: iq.question_text,
      options: iq.options as string[],
      difficulty: iq.difficulty,
      orderIndex: iq.order_index,
    }));

    return Response.json({
      quiz: {
        id: quiz.id,
        topicSlug: targetTopicSlug,
        topicName: targetTopicName,
        difficultyLevel: quiz.difficulty_level,
        status: quiz.status,
        totalQuestions: clientQuestions.length,
        conversationId: conversationId || null,
      },
      questions: clientQuestions,
    });
  } catch (error: unknown) {
    return handleRouteError(error, "Failed to generate quiz");
  }
}
