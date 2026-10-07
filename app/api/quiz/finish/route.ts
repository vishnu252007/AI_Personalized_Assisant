import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const finishQuizSchema = z.object({
  quizId: z.string().uuid("Invalid quiz ID"),
});

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
    const parsed = finishQuizSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid quiz finish payload", code: "VALIDATION_ERROR", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { quizId } = parsed.data;
    const admin = createAdminClient();

    // 1. Fetch quiz record
    const { data: quiz, error: quizError } = await admin
      .from("quizzes")
      .select("id, user_id, score, total_questions, status, topic_id, topics(name, slug)")
      .eq("id", quizId)
      .eq("user_id", user.id)
      .single();

    if (quizError || !quiz) {
      return NextResponse.json(
        { error: "Quiz not found or unauthorized", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // 2. Mark quiz completed if not already completed
    if (quiz.status !== "completed") {
      await admin
        .from("quizzes")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", quizId);
    }

    // 3. Fetch incorrect attempts for this quiz to identify misconceptions and weaknesses
    const { data: attempts } = await admin
      .from("attempts")
      .select("question_id, is_correct, questions(question_text, topic_id, topics(name))")
      .eq("quiz_id", quizId)
      .eq("user_id", user.id);

    const totalQuestions = quiz.total_questions || (attempts ? attempts.length : 1);
    const score = quiz.score;
    const accuracy = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

    const weakTopicsSet = new Set<string>();
    const misconceptionsFound: string[] = [];

    for (const att of attempts || []) {
      const q = att.questions as unknown as { topics?: { name: string } | null } | null;
      if (!att.is_correct && q?.topics?.name) {
        weakTopicsSet.add(q.topics.name);
      }
    }

    return NextResponse.json({
      score,
      totalQuestions,
      accuracy,
      weakTopics: Array.from(weakTopicsSet),
      misconceptions: misconceptionsFound,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[POST /api/quiz/finish Error]:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to finish quiz", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
