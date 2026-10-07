import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/ai/provider";
import { buildQuizGeneratorPrompt } from "@/lib/ai/prompts";
import { quizBatchGenerationSchema, generateQuizRequestSchema } from "@/lib/ai/schemas";
import { CURATED_TOPICS, canonicalizeTopicSlug } from "@/lib/learner/topics";
import { calculateRetentionProbability, isDueForReview } from "@/lib/learner/forgetting";
import { calculateEffectiveMastery } from "@/lib/learner/mastery";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
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

    const rateLimit = await checkRateLimit(user.id);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before generating another quiz.", code: "RATE_LIMITED" },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = generateQuizRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid quiz generation payload", code: "VALIDATION_ERROR", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { mode, topicSlug: requestedSlug } = parsed.data;
    const admin = createAdminClient();

    // 1. Fetch user's learner states to determine targeted topic
    const { data: states } = await admin
      .from("learner_topic_state")
      .select("topic_id, mastery_score, half_life_days, last_reviewed_at, misconceptions, topics(id, slug, name, difficulty_level)")
      .eq("user_id", user.id);

    let targetTopicSlug = requestedSlug;
    let targetDifficulty = 2;

    if (mode === "recommended" || !targetTopicSlug) {
      // Find topics due for review or lowest in effective mastery
      const evaluated = (states || []).map((s: { last_reviewed_at: string; half_life_days: number; mastery_score: number; topics?: { slug: string; difficulty_level: number } | null }) => {
        const diffMs = Math.max(0, Date.now() - new Date(s.last_reviewed_at).getTime());
        const daysSince = diffMs / (1000 * 60 * 60 * 24);
        const R = calculateRetentionProbability(daysSince, Number(s.half_life_days));
        const effective = calculateEffectiveMastery(Number(s.mastery_score), R);
        return {
          slug: s.topics?.slug,
          difficulty: s.topics?.difficulty_level || 2,
          isDue: isDueForReview(R),
          effectiveMastery: effective,
        };
      });

      const dueTopic = evaluated.find((e) => e.isDue);
      if (dueTopic?.slug) {
        targetTopicSlug = dueTopic.slug;
        targetDifficulty = dueTopic.difficulty;
      } else if (evaluated.length > 0) {
        evaluated.sort((a, b) => a.effectiveMastery - b.effectiveMastery);
        targetTopicSlug = evaluated[0].slug;
        targetDifficulty = evaluated[0].difficulty;
      } else {
        // First session: start with introductory topic
        targetTopicSlug = "arrays-and-hashing";
        targetDifficulty = 1;
      }
    }

    const canonicalSlug = canonicalizeTopicSlug(targetTopicSlug || "arrays-and-hashing");
    const topicMeta = CURATED_TOPICS.find((t) => t.slug === canonicalSlug) || CURATED_TOPICS[0];

    // Ensure topic exists in DB
    const { data: dbTopic } = await admin
      .from("topics")
      .select("id")
      .eq("slug", topicMeta.slug)
      .single();

    const topicId = dbTopic?.id || null;

    // 2. Generate questions with AI Provider (structured output)
    const provider = getProvider();
    const prompt = buildQuizGeneratorPrompt(topicMeta.name, targetDifficulty, 4);

    let generatedQuestions;
    try {
      generatedQuestions = await provider.generateStructured(
        prompt,
        quizBatchGenerationSchema
      );
    } catch {
      // Retry once on validation/generation failure
      generatedQuestions = await provider.generateStructured(
        prompt + "\n\nCRITICAL: Ensure strict JSON formatting matching the schema.",
        quizBatchGenerationSchema
      );
    }

    // 3. Insert Quiz record using admin client (derived data write)
    const { data: quiz, error: quizError } = await admin
      .from("quizzes")
      .insert({
        user_id: user.id,
        topic_id: topicId,
        difficulty_level: targetDifficulty,
        status: "in_progress",
        total_questions: generatedQuestions.questions.length,
      })
      .select("id, status, difficulty_level, total_questions, created_at")
      .single();

    if (quizError || !quiz) {
      return NextResponse.json(
        { error: "Failed to persist quiz record", code: "DATABASE_ERROR" },
        { status: 500 }
      );
    }

    // 4. Insert Questions and Question Keys
    const clientQuestions: Array<{
      id: string;
      questionText: string;
      options: string[];
      difficulty: number;
      orderIndex: number;
    }> = [];

    for (let i = 0; i < generatedQuestions.questions.length; i++) {
      const q = generatedQuestions.questions[i];

      const { data: insertedQ, error: qErr } = await admin
        .from("questions")
        .insert({
          quiz_id: quiz.id,
          topic_id: topicId,
          difficulty: q.difficulty,
          question_text: q.questionText,
          options: q.options,
          order_index: i,
        })
        .select("id, question_text, options, difficulty, order_index")
        .single();

      if (qErr || !insertedQ) continue;

      // Store answer key securely on server (zero client access)
      await admin.from("question_keys").insert({
        question_id: insertedQ.id,
        correct_index: q.correctIndex,
        rationales: q.rationales,
        misconception_tags: q.misconceptionTags,
      });

      // Strip correct_index and rationales from client payload
      clientQuestions.push({
        id: insertedQ.id,
        questionText: insertedQ.question_text,
        options: insertedQ.options as string[],
        difficulty: insertedQ.difficulty,
        orderIndex: insertedQ.order_index,
      });
    }

    return NextResponse.json({
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
    return NextResponse.json(
      { error: err?.message || "Failed to generate quiz", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
