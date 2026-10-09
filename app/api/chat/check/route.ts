import { z } from "zod";
import { getProvider } from "@/lib/ai/provider";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, apiError, handleRouteError } from "@/lib/api-helpers";
import { applyLearningEvent } from "@/lib/learner/engine-v2";

export const runtime = "nodejs";

const checkPayloadSchema = z.object({
  questionText: z.string().min(3),
  studentAnswer: z.string().min(1),
  conversationId: z.string().uuid().optional(),
  conceptSlug: z.string().optional(),
});

const checkRubricSchema = z.object({
  evaluation: z.enum(["correct", "partial", "wrong"]),
  misconceptionTag: z.string().nullable(),
  feedback: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;
    const user = auth.user;

    const body = await request.json().catch(() => ({}));
    const parsed = checkPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid check answer payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const { questionText, studentAnswer, conversationId, conceptSlug } = parsed.data;
    const admin = createAdminClient();

    // Find topic ID if conceptSlug provided
    let topicId: string | null = null;
    if (conceptSlug) {
      const { data: topic } = await admin
        .from("topics")
        .select("id")
        .eq("slug", conceptSlug)
        .maybeSingle();
      topicId = topic?.id || null;
    }

    // Evaluate answer with LLM rubric
    const prompt = `You are LearnAI's cognitive evaluator.
Evaluate this student's response to an in-lesson concept check question.

Question:
"${questionText}"

Student's Answer:
"${studentAnswer}"

Rubric:
- evaluation: "correct" if the core conceptual principle is sound; "partial" if partially right but incomplete or slightly inaccurate; "wrong" if incorrect or reveals a misconception.
- misconceptionTag: Short kebab-case tag identifying error (e.g. "off-by-one", "hash-collision", "quadratic-assumption") or null if correct.
- feedback: Concise, encouraging 1-sentence pedagogical response addressing the specific point.`;

    const provider = getProvider();
    const result = await provider.generateStructured(
      prompt,
      checkRubricSchema,
      "You are a computer science pedagogy evaluator. Give honest, constructive ratings."
    );

    // Apply learning event (weight: 0.10)
    await applyLearningEvent(admin, {
      userId: user.id,
      eventType: "check_answered",
      topicId,
      conceptSlug: conceptSlug || null,
      conversationId: conversationId || null,
      payload: {
        question: questionText,
        evaluation: result.evaluation,
        success: result.evaluation === "correct",
        score: result.evaluation === "correct" ? 1.0 : result.evaluation === "partial" ? 0.5 : 0.0,
        misconceptionTag: result.misconceptionTag,
      },
      weight: 0.10,
    });

    return Response.json({
      evaluation: result.evaluation,
      misconceptionTag: result.misconceptionTag,
      feedback: result.feedback,
    });
  } catch (error: unknown) {
    return handleRouteError(error, "Failed to evaluate concept check");
  }
}
