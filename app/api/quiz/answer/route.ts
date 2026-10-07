import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { submitAnswerSchema } from "@/lib/ai/schemas";
import { calculateNewMastery, calculateResponseOutcome } from "@/lib/learner/mastery";
import { calculateRetentionProbability, calculateUpdatedHalfLife } from "@/lib/learner/forgetting";
import { updateStyleStats } from "@/lib/learner/bandit";

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

    const body = await request.json().catch(() => ({}));
    const parsed = submitAnswerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid submission payload", code: "VALIDATION_ERROR", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { quizId, questionId, chosenIndex, timeMs } = parsed.data;
    const admin = createAdminClient();

    // 1. Verify quiz ownership and in_progress status
    const { data: quiz, error: quizError } = await admin
      .from("quizzes")
      .select("id, user_id, status, topic_id, score")
      .eq("id", quizId)
      .eq("user_id", user.id)
      .single();

    if (quizError || !quiz) {
      return NextResponse.json(
        { error: "Quiz not found or unauthorized", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (quiz.status !== "in_progress") {
      return NextResponse.json(
        { error: "Quiz is already completed or inactive", code: "QUIZ_INACTIVE" },
        { status: 400 }
      );
    }

    // 2. Prevent duplicate answer submission (Acceptance Check: Duplicate answer submission is rejected)
    const { data: existingAttempt } = await admin
      .from("attempts")
      .select("id")
      .eq("user_id", user.id)
      .eq("question_id", questionId)
      .maybeSingle();

    if (existingAttempt) {
      return NextResponse.json(
        { error: "Duplicate answer submission: question has already been answered", code: "DUPLICATE_SUBMISSION" },
        { status: 409 }
      );
    }

    // 3. Fetch server-side question key and question metadata
    const [keyRes, questionRes] = await Promise.all([
      admin.from("question_keys").select("correct_index, rationales, misconception_tags").eq("question_id", questionId).single(),
      admin.from("questions").select("difficulty, topic_id").eq("id", questionId).single(),
    ]);

    if (!keyRes.data || !questionRes.data) {
      return NextResponse.json(
        { error: "Question evaluation metadata not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const correctIndex = keyRes.data.correct_index;
    const rationales = keyRes.data.rationales as string[];
    const misconceptionTags = keyRes.data.misconception_tags as (string | null)[];
    const difficulty = questionRes.data.difficulty;
    const topicId = questionRes.data.topic_id || quiz.topic_id;

    const isCorrect = chosenIndex === correctIndex;
    const explanation = rationales[chosenIndex] || "No explanation provided.";

    // 4. Log attempt record in database
    const { error: attemptInsertError } = await admin.from("attempts").insert({
      quiz_id: quizId,
      question_id: questionId,
      user_id: user.id,
      selected_index: chosenIndex,
      is_correct: isCorrect,
      response_time_ms: timeMs,
    });

    if (attemptInsertError) {
      return NextResponse.json(
        { error: "Failed to record attempt", code: "DATABASE_ERROR" },
        { status: 500 }
      );
    }

    // 5. Update quiz score if correct
    if (isCorrect) {
      await admin
        .from("quizzes")
        .update({ score: quiz.score + 1 })
        .eq("id", quizId);
    }

    // 6. Recalibrate learner state (Elo mastery and retention half-life) if topic is attached
    if (topicId) {
      const { data: state } = await admin
        .from("learner_topic_state")
        .select("id, mastery_score, half_life_days, attempts_count, last_reviewed_at, misconceptions")
        .eq("user_id", user.id)
        .eq("topic_id", topicId)
        .maybeSingle();

      const currentMastery = state ? Number(state.mastery_score) : 0.5;
      const currentHalfLife = state ? Number(state.half_life_days) : 2.0;
      const attemptsCount = state ? state.attempts_count : 0;
      const misconceptionsMap = (state?.misconceptions as Record<string, number>) || {};

      // Latency-weighted outcome (slow correct answer -> 0.8)
      const outcome = calculateResponseOutcome(isCorrect, timeMs);

      // Elo mastery update (K_base = 0.15 for verified quiz attempt)
      const newMastery = calculateNewMastery({
        currentMastery,
        difficulty,
        outcome,
        attemptsCount,
        isQuizAttempt: true,
      });

      // Half-life update
      const diffMs = state ? Math.max(0, Date.now() - new Date(state.last_reviewed_at).getTime()) : 0;
      const daysSince = diffMs / (1000 * 60 * 60 * 24);
      const currentR = calculateRetentionProbability(daysSince, currentHalfLife);
      const newHalfLife = calculateUpdatedHalfLife(currentHalfLife, isCorrect, currentR);

      // Misconception tracking: wrong option carries misconception tag
      const updatedMisconceptions = { ...misconceptionsMap };
      if (!isCorrect) {
        const tag = misconceptionTags[chosenIndex];
        if (tag) {
          updatedMisconceptions[tag] = (updatedMisconceptions[tag] || 0) + 1;
        }
      } else {
        // Slow decay on correct answer
        for (const tag of Object.keys(updatedMisconceptions)) {
          if (updatedMisconceptions[tag] > 0) {
            updatedMisconceptions[tag] = Math.max(0, updatedMisconceptions[tag] - 1);
          }
        }
      }

      await admin.from("learner_topic_state").upsert(
        {
          user_id: user.id,
          topic_id: topicId,
          mastery_score: newMastery,
          half_life_days: newHalfLife,
          attempts_count: attemptsCount + 1,
          last_reviewed_at: new Date().toISOString(),
          misconceptions: updatedMisconceptions,
        },
        { onConflict: "user_id,topic_id" }
      );
    }

    // 7. Update explanation bandit reward (1 if correct, else 0)
    const reward: 1 | 0 = isCorrect ? 1 : 0;
    const { data: currentStyles } = await admin
      .from("style_stats")
      .select("style, alpha, beta")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (currentStyles) {
      const updated = updateStyleStats(
        { alpha: Number(currentStyles.alpha), beta: Number(currentStyles.beta) },
        reward
      );
      await admin.from("style_stats").upsert(
        {
          user_id: user.id,
          style: currentStyles.style,
          alpha: updated.alpha,
          beta: updated.beta,
        },
        { onConflict: "user_id,style" }
      );
    }

    return NextResponse.json({
      correct: isCorrect,
      correctIndex,
      explanation,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[POST /api/quiz/answer Error]:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to submit answer", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
