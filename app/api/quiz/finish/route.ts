import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, apiError } from "@/lib/api-helpers";

export const runtime = "nodejs";

const finishQuizSchema = z.object({
  quizId: z.string().uuid("Invalid quiz ID"),
});

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;
    const user = auth.user;

    const body = await request.json().catch(() => ({}));
    const parsed = finishQuizSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "Invalid quiz finish payload",
        "VALIDATION_ERROR",
        400,
        parsed.error.flatten()
      );
    }

    const { quizId } = parsed.data;
    const admin = createAdminClient();

    // 1. Fetch quiz record
    const { data: quiz, error: quizError } = await admin
      .from("quizzes")
      .select(
        "id, user_id, total_questions, status, topic_id, topics(name, slug)"
      )
      .eq("id", quizId)
      .eq("user_id", user.id)
      .single();

    if (quizError || !quiz) {
      return apiError("Quiz not found or unauthorized", "NOT_FOUND", 404);
    }

    // 2. Compute score from actual attempts
    const { data: attempts } = await admin
      .from("attempts")
      .select(
        "question_id, is_correct, selected_index, questions(question_text, options, topic_id, topics(name))"
      )
      .eq("quiz_id", quizId)
      .eq("user_id", user.id);

    const attemptsList = attempts || [];
    const correctCount = attemptsList.filter(
      (a: { is_correct: boolean }) => a.is_correct
    ).length;
    const totalQuestions =
      quiz.total_questions || attemptsList.length || 1;
    const accuracy =
      totalQuestions > 0
        ? Math.round((correctCount / totalQuestions) * 100)
        : 0;

    // 3. Mark quiz completed and set computed score
    if (quiz.status !== "completed") {
      await admin
        .from("quizzes")
        .update({
          status: "completed",
          score: correctCount,
          completed_at: new Date().toISOString(),
        })
        .eq("id", quizId);
    }

    // 4. Build real misconceptions from incorrect attempts via question_keys
    const incorrectAttempts = attemptsList.filter(
      (a: { is_correct: boolean }) => !a.is_correct
    );
    const misconceptionsFound: string[] = [];
    const weakTopicsSet = new Set<string>();

    if (incorrectAttempts.length > 0) {
      const questionIds = incorrectAttempts.map(
        (a: { question_id: string }) => a.question_id
      );

      const { data: keys } = await admin
        .from("question_keys")
        .select("question_id, misconception_tags")
        .in("question_id", questionIds);

      for (const att of incorrectAttempts) {
        const typedAtt = att as {
          question_id: string;
          selected_index: number;
          questions: {
            topics?: { name: string } | null;
          } | null;
        };

        // Collect weak topic
        const topicName = typedAtt.questions?.topics?.name;
        if (topicName) {
          weakTopicsSet.add(topicName);
        }

        // Collect misconception tag from the chosen wrong answer
        const key = (keys || []).find(
          (k: { question_id: string }) =>
            k.question_id === typedAtt.question_id
        );
        if (key) {
          const tags = key.misconception_tags as (string | null)[];
          const tag = tags[typedAtt.selected_index];
          if (tag && !misconceptionsFound.includes(tag)) {
            misconceptionsFound.push(tag);
          }
        }
      }
    }

    // 5. Build per-question review
    const questionReview = attemptsList.map((a) => ({
      questionId: a.question_id,
      questionText: a.questions?.question_text || "",
      isCorrect: a.is_correct,
      selectedIndex: a.selected_index,
      topicName: a.questions?.topics?.name || null,
    }));

    return Response.json({
      score: correctCount,
      totalQuestions,
      accuracy,
      weakTopics: Array.from(weakTopicsSet),
      misconceptions: misconceptionsFound,
      questionReview,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[POST /api/quiz/finish Error]:", err);
    return apiError("Failed to finish quiz", "INTERNAL_ERROR", 500);
  }
}
