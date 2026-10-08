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
import { requireUser, apiError } from "@/lib/api-helpers";
import { getFallbackQuestions } from "@/lib/ai/fallback-questions";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;
    const user = auth.user;

    // Stricter rate limit: quiz generation is expensive
    const rateLimit = await checkRateLimit(`quiz:${user.id}`);
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

    const { mode, topicSlug: requestedSlug } = parsed.data;
    const admin = createAdminClient();

    // 1. Fetch user's learner states
    const { data: states } = await admin
      .from("learner_topic_state")
      .select(
        "topic_id, mastery_score, half_life_days, last_reviewed_at, misconceptions, topics(id, slug, name, difficulty_level)"
      )
      .eq("user_id", user.id);

    // Build a set of topic slugs the user has seen
    const seenSlugs = new Set(
      (states || [])
        .map(
          (s: { topics?: { slug: string } | null }) => s.topics?.slug
        )
        .filter(Boolean) as string[]
    );

    let targetTopicSlug = requestedSlug;
    let targetDifficulty = 2;
    let questionCount = 4;
    let topMisconceptions: string[] = [];

    if (mode === "diagnostic") {
      // Diagnostic mode: 6-8 questions across core topics
      questionCount = 7;
      // Include unseen topics in diagnostics
      const unseenTopics = CURATED_TOPICS.filter(
        (t) => !seenSlugs.has(t.slug)
      );
      const firstUnseen = unseenTopics[0];
      targetTopicSlug = firstUnseen?.slug || "arrays-and-hashing";
      targetDifficulty = 2;
    } else if (mode === "topic" && requestedSlug) {
      // Topic mode: validate slug exists in curated list
      const match = CURATED_TOPICS.find((t) => t.slug === requestedSlug);
      if (!match) {
        return apiError(
          `Unknown topic slug: "${requestedSlug}"`,
          "UNKNOWN_TOPIC",
          400
        );
      }
      targetTopicSlug = match.slug;
      targetDifficulty = match.difficultyLevel;
    } else {
      // Recommended mode: pick lowest retention topic, or unseen, or lowest mastery
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
          difficulty: s.topics?.difficulty_level || 2,
          isDue: isDueForReview(R),
          effectiveMastery: effective,
          retentionProbability: R,
          mastery: Number(s.mastery_score),
          misconceptions: (s.misconceptions as Record<string, number>) || {},
        };
      });

      // Priority 1: lowest retention (most forgotten) topic
      const dueTopics = evaluated
        .filter((e) => e.isDue && e.slug)
        .sort((a, b) => a.retentionProbability - b.retentionProbability);

      if (dueTopics.length > 0 && dueTopics[0].slug) {
        targetTopicSlug = dueTopics[0].slug;
        // Derive difficulty from mastery
        targetDifficulty = Math.max(
          1,
          Math.min(5, Math.round(dueTopics[0].mastery * 5))
        );
        // Collect top misconceptions
        topMisconceptions = Object.entries(dueTopics[0].misconceptions)
          .sort((a, b) => (b[1] as number) - (a[1] as number))
          .slice(0, 3)
          .map(([tag]) => tag);
      } else if (evaluated.length > 0) {
        // Check for unseen topics first
        const unseenTopics = CURATED_TOPICS.filter(
          (t) => !seenSlugs.has(t.slug)
        );
        if (unseenTopics.length > 0) {
          targetTopicSlug = unseenTopics[0].slug;
          targetDifficulty = unseenTopics[0].difficultyLevel;
        } else {
          // Lowest effective mastery
          evaluated.sort((a, b) => a.effectiveMastery - b.effectiveMastery);
          targetTopicSlug = evaluated[0].slug;
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
        // First session
        targetTopicSlug = "arrays-and-hashing";
        targetDifficulty = 1;
      }
    }

    const topicMeta =
      CURATED_TOPICS.find((t) => t.slug === targetTopicSlug) ||
      CURATED_TOPICS[0];

    // Ensure topic exists in DB
    const { data: dbTopic } = await admin
      .from("topics")
      .select("id")
      .eq("slug", topicMeta.slug)
      .single();

    const topicId = dbTopic?.id || null;

    // 2. Generate questions with AI Provider, with fallback question bank
    let questions: QuizQuestionGenerated[];

    try {
      const provider = getProvider();
      const prompt = buildQuizGeneratorPrompt(
        topicMeta.name,
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
      const fallback = getFallbackQuestions(topicMeta.slug, questionCount);
      questions = fallback;
    }

    if (questions.length === 0) {
      return apiError(
        "Failed to generate quiz questions",
        "GENERATION_FAILED",
        500
      );
    }

    // 3. Insert Quiz + Questions + Keys in a batch with error checking
    const { data: quiz, error: quizError } = await admin
      .from("quizzes")
      .insert({
        user_id: user.id,
        topic_id: topicId,
        difficulty_level: targetDifficulty,
        status: "in_progress",
        total_questions: questions.length,
      })
      .select("id, status, difficulty_level, total_questions, created_at")
      .single();

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
      // Rollback: delete the quiz since questions failed
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
      // Rollback: delete quiz and its questions
      await admin.from("questions").delete().eq("quiz_id", quiz.id);
      await admin.from("quizzes").delete().eq("id", quiz.id);
      return apiError(
        "Failed to insert question keys",
        "DATABASE_ERROR",
        500
      );
    }

    // Strip secrets from client payload
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
        topicSlug: topicMeta.slug,
        topicName: topicMeta.name,
        difficultyLevel: quiz.difficulty_level,
        status: quiz.status,
        totalQuestions: clientQuestions.length,
      },
      questions: clientQuestions,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[POST /api/quiz/generate Error]:", err);
    return apiError("Failed to generate quiz", "INTERNAL_ERROR", 500);
  }
}
