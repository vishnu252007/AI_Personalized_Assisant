import { createAdminClient } from "@/lib/supabase/admin";
import { submitAnswerSchema } from "@/lib/ai/schemas";
import { calculateNewMastery, calculateResponseOutcome } from "@/lib/learner/mastery";
import { calculateRetentionProbability, calculateUpdatedHalfLife } from "@/lib/learner/forgetting";
import { updateStyleStats } from "@/lib/learner/bandit";
import { requireUser, apiError } from "@/lib/api-helpers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;
    const user = auth.user;

    const body = await request.json().catch(() => ({}));
    const parsed = submitAnswerSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "Invalid submission payload",
        "VALIDATION_ERROR",
        400,
        parsed.error.flatten()
      );
    }

    const { quizId, questionId, chosenIndex, timeMs } = parsed.data;
    const admin = createAdminClient();

    // Try calling atomic PostgreSQL RPC function with row locks first
    try {
      const { data: rpcResult, error: rpcErr } = await admin.rpc(
        "submit_quiz_answer" as never,
        {
          p_user_id: user.id,
          p_quiz_id: quizId,
          p_question_id: questionId,
          p_chosen_index: chosenIndex,
          p_time_ms: timeMs,
        } as never
      );

      if (!rpcErr && rpcResult) {
        return Response.json(rpcResult);
      }

      if (rpcErr) {
        if (rpcErr.message?.includes("DUPLICATE_SUBMISSION")) {
          return apiError(
            "Duplicate answer submission: question has already been answered",
            "DUPLICATE_SUBMISSION",
            409
          );
        }
        if (rpcErr.message?.includes("QUIZ_INACTIVE")) {
          return apiError(
            "Quiz is already completed or inactive",
            "QUIZ_INACTIVE",
            400
          );
        }
        if (rpcErr.message?.includes("QUIZ_NOT_FOUND")) {
          return apiError("Quiz not found or unauthorized", "NOT_FOUND", 404);
        }
        if (rpcErr.message?.includes("QUESTION_NOT_FOUND")) {
          return apiError("Question not found in this quiz", "NOT_FOUND", 404);
        }
      }
    } catch {
      // Fallback to transactional TS flow if RPC is not present in target DB
    }

    // 1. Verify quiz ownership and in_progress status
    const { data: quiz, error: quizError } = await admin
      .from("quizzes")
      .select("id, user_id, status, topic_id, score")
      .eq("id", quizId)
      .eq("user_id", user.id)
      .single();

    if (quizError || !quiz) {
      return apiError("Quiz not found or unauthorized", "NOT_FOUND", 404);
    }

    if (quiz.status !== "in_progress") {
      return apiError(
        "Quiz is already completed or inactive",
        "QUIZ_INACTIVE",
        400
      );
    }

    // 2. Verify question belongs to this quiz
    const { data: question, error: questionErr } = await admin
      .from("questions")
      .select("id, difficulty, topic_id, quiz_id")
      .eq("id", questionId)
      .eq("quiz_id", quizId)
      .single();

    if (questionErr || !question) {
      return apiError(
        "Question not found in this quiz",
        "NOT_FOUND",
        404
      );
    }

    // 3. Prevent duplicate answer submission
    const { data: existingAttempt } = await admin
      .from("attempts")
      .select("id")
      .eq("user_id", user.id)
      .eq("question_id", questionId)
      .maybeSingle();

    if (existingAttempt) {
      return apiError(
        "Duplicate answer submission: question has already been answered",
        "DUPLICATE_SUBMISSION",
        409
      );
    }

    // 4. Fetch server-side question key
    const { data: keyData, error: keyErr } = await admin
      .from("question_keys")
      .select("correct_index, rationales, misconception_tags")
      .eq("question_id", questionId)
      .single();

    if (keyErr || !keyData) {
      return apiError(
        "Question evaluation metadata not found",
        "NOT_FOUND",
        404
      );
    }

    const correctIndex = keyData.correct_index;
    const rationales = keyData.rationales as string[];
    const misconceptionTags = keyData.misconception_tags as (string | null)[];
    const difficulty = question.difficulty;
    const topicId = question.topic_id || quiz.topic_id;

    const isCorrect = chosenIndex === correctIndex;
    const chosenExplanation = rationales[chosenIndex] || "No explanation provided.";
    const correctExplanation = rationales[correctIndex] || "No explanation provided.";

    // 5. Log attempt and update quiz score
    const { error: attemptInsertError } = await admin.from("attempts").insert({
      quiz_id: quizId,
      question_id: questionId,
      user_id: user.id,
      selected_index: chosenIndex,
      is_correct: isCorrect,
      response_time_ms: timeMs,
    });

    if (attemptInsertError) {
      return apiError("Failed to record attempt", "DATABASE_ERROR", 500);
    }

    if (isCorrect) {
      await admin
        .from("quizzes")
        .update({ score: quiz.score + 1 })
        .eq("id", quizId);
    }

    // 6. Recalibrate learner state (Elo mastery and retention half-life)
    if (topicId) {
      const { data: state } = await admin
        .from("learner_topic_state")
        .select(
          "id, mastery_score, half_life_days, attempts_count, last_reviewed_at, misconceptions"
        )
        .eq("user_id", user.id)
        .eq("topic_id", topicId)
        .maybeSingle();

      const currentMastery = state ? Number(state.mastery_score) : 0.5;
      const currentHalfLife = state ? Number(state.half_life_days) : 2.0;
      const attemptsCount = state ? state.attempts_count : 0;
      const misconceptionsMap =
        (state?.misconceptions as Record<string, number>) || {};

      const outcome = calculateResponseOutcome(isCorrect, timeMs);

      const newMastery = calculateNewMastery({
        currentMastery,
        difficulty,
        outcome,
        attemptsCount,
        isQuizAttempt: true,
      });

      const diffMs = state
        ? Math.max(0, Date.now() - new Date(state.last_reviewed_at).getTime())
        : 0;
      const daysSince = diffMs / (1000 * 60 * 60 * 24);
      const currentR = calculateRetentionProbability(daysSince, currentHalfLife);
      const newHalfLife = calculateUpdatedHalfLife(
        currentHalfLife,
        isCorrect,
        currentR
      );

      // Misconception tracking
      const updatedMisconceptions = { ...misconceptionsMap };
      if (!isCorrect) {
        const tag = misconceptionTags[chosenIndex];
        if (tag) {
          updatedMisconceptions[tag] =
            (updatedMisconceptions[tag] || 0) + 1;
        }
      } else {
        // Slow decay on correct answer
        for (const tag of Object.keys(updatedMisconceptions)) {
          if (updatedMisconceptions[tag] > 0) {
            updatedMisconceptions[tag] = Math.max(
              0,
              updatedMisconceptions[tag] - 1
            );
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

    // 7. Credit quiz answers on that topic to the style used
    if (topicId) {
      const { data: topicConvs } = await admin
        .from("conversations")
        .select("id")
        .eq("user_id", user.id)
        .eq("topic_id", topicId)
        .order("updated_at", { ascending: false })
        .limit(5);

      const convIds = (topicConvs || []).map((c) => c.id);
      let styleToCredit: "analogy" | "steps" | "example" | null = null;

      if (convIds.length > 0) {
        const { data: topicMsg } = await admin
          .from("messages")
          .select("style")
          .in("conversation_id", convIds)
          .eq("role", "assistant")
          .not("style", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (topicMsg?.style) {
          styleToCredit = topicMsg.style as "analogy" | "steps" | "example";
        }
      }

      if (!styleToCredit) {
        const { data: latestMsg } = await admin
          .from("messages")
          .select("style")
          .eq("role", "assistant")
          .not("style", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestMsg?.style) {
          styleToCredit = latestMsg.style as "analogy" | "steps" | "example";
        }
      }

      if (!styleToCredit) {
        styleToCredit = "analogy";
      }

      const { data: existingStyles } = await admin
        .from("style_stats")
        .select("style, alpha, beta")
        .eq("user_id", user.id);

      const currentStats = existingStyles || [];
      const statRow = currentStats.find((s) => s.style === styleToCredit);
      const currentAlpha = statRow ? Number(statRow.alpha) : 1.0;
      const currentBeta = statRow ? Number(statRow.beta) : 1.0;

      const reward: 1 | 0 = isCorrect ? 1 : 0;
      const updated = updateStyleStats(
        { alpha: currentAlpha, beta: currentBeta },
        reward
      );

      await admin.from("style_stats").upsert(
        {
          user_id: user.id,
          style: styleToCredit,
          alpha: updated.alpha,
          beta: updated.beta,
        },
        { onConflict: "user_id,style" }
      );
    }

    // Return explanations for both chosen and correct options
    return Response.json({
      correct: isCorrect,
      correctIndex,
      chosenExplanation,
      correctExplanation,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[POST /api/quiz/answer Error]:", err);
    return apiError("Failed to submit answer", "INTERNAL_ERROR", 500);
  }
}
