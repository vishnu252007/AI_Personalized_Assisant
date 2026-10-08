import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/ai/provider";
import { selectExplanationStyle, type StyleStat, EXPLANATION_STYLES } from "@/lib/learner/bandit";
import { buildProfileSummary } from "@/lib/learner/profile";
import { analyzeConversationTurn } from "@/lib/learner/analyzer";
import { calculateRetentionProbability, isDueForReview } from "@/lib/learner/forgetting";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser, apiError } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  // Resolve the after() promise tracker — resolved on success, error, or abort
  let resolveAssistantText: (text: string) => void = () => {};
  const assistantTextPromise = new Promise<string>((resolve) => {
    resolveAssistantText = resolve;
  });

  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;
    const user = auth.user;

    const rateLimit = await checkRateLimit(user.id);
    if (!rateLimit.success) {
      return apiError(
        "Rate limit exceeded. Please wait before sending more messages.",
        "RATE_LIMITED",
        429
      );
    }

    // Accept raw body — we extract only what we need
    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return apiError("Invalid request payload", "VALIDATION_ERROR", 400);
    }

    // Extract the latest user message from the UI messages
    const uiMessages: Array<{ role: string; content: string }> = body.messages;
    const latestUserMsg = [...uiMessages]
      .reverse()
      .find((m) => m.role === "user");
    if (!latestUserMsg || typeof latestUserMsg.content !== "string" || latestUserMsg.content.trim().length === 0) {
      return apiError("No user message found", "VALIDATION_ERROR", 400);
    }

    const supabase = await createClient();
    let conversationId: string | undefined = body.conversationId;

    // 1. Resolve or create conversation
    if (!conversationId) {
      const { data: newConv, error: convErr } = await supabase
        .from("conversations")
        .insert({
          user_id: user.id,
          title: latestUserMsg.content.slice(0, 40) + "...",
        })
        .select("id")
        .single();

      if (convErr || !newConv) {
        return apiError(
          "Failed to initialize conversation session",
          "DATABASE_ERROR",
          500
        );
      }
      conversationId = newConv.id;
    } else {
      // Verify conversation ownership
      const { data: conv } = await supabase
        .from("conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!conv) {
        return apiError("Conversation not found", "NOT_FOUND", 404);
      }
    }

    // 2. Persist the incoming user message — check insert error
    const { error: msgInsertErr } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: latestUserMsg.content,
    });
    if (msgInsertErr) {
      console.error("[Chat] Failed to persist user message:", msgInsertErr);
    }

    // 3. Load conversation history from DB (authoritative source)
    const { data: dbMessages } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(50);

    const historyMessages = (dbMessages || []).map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    // 4. Fetch learner profile, bandit stats, and topic states
    const admin = createAdminClient();
    const [profileRes, styleRes, topicsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("level, subject")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("style_stats")
        .select("style, alpha, beta")
        .eq("user_id", user.id),
      supabase
        .from("learner_topic_state")
        .select(
          "topic_id, mastery_score, half_life_days, attempts_count, last_reviewed_at, misconceptions, topics(name, slug)"
        )
        .eq("user_id", user.id),
    ]);

    // Ensure style_stats rows exist for all 3 styles on first use
    const existingStyles = (styleRes.data || []).map(
      (s: { style: string }) => s.style
    );
    const missingStyles = EXPLANATION_STYLES.filter(
      (s) => !existingStyles.includes(s)
    );
    if (missingStyles.length > 0) {
      await admin.from("style_stats").insert(
        missingStyles.map((s) => ({
          user_id: user.id,
          style: s,
          alpha: 1.0,
          beta: 1.0,
        }))
      );
    }

    const styleStats: StyleStat[] = (styleRes.data || []).map(
      (s: { style: string; alpha: number; beta: number }) => ({
        style: s.style as "analogy" | "steps" | "example",
        alpha: Number(s.alpha),
        beta: Number(s.beta),
      })
    );

    // Choose pedagogical style via Thompson Sampling
    const activeStyle = selectExplanationStyle(
      styleStats.length > 0
        ? styleStats
        : [
            { style: "analogy", alpha: 1.0, beta: 1.0 },
            { style: "steps", alpha: 1.0, beta: 1.0 },
            { style: "example", alpha: 1.0, beta: 1.0 },
          ]
    );

    // Handle request abort so after() tracker promise resolves
    request.signal.addEventListener("abort", () => {
      resolveAssistantText("");
    });

    // Build profile summary with real retention, due-review, and misconception data
    const topicStates = (topicsRes.data || []).map((t) => {
      const daysSince =
        Math.max(
          0,
          Date.now() - new Date(t.last_reviewed_at).getTime()
        ) /
        (1000 * 60 * 60 * 24);
      const R = calculateRetentionProbability(daysSince, Number(t.half_life_days));
      return {
        name: t.topics?.name || "Topic",
        slug: t.topics?.slug || "topic",
        masteryScore: Number(t.mastery_score),
        effectiveMastery: Number(t.mastery_score) * R,
        attemptsCount: t.attempts_count,
        retentionProbability: R,
        isDueForReview: isDueForReview(R),
      };
    });

    // Aggregate misconceptions across topics (capped length for prompt safety)
    const misconceptions: Record<string, number> = {};
    for (const t of topicsRes.data || []) {
      const mc = (t as { misconceptions?: Record<string, number> }).misconceptions || {};
      for (const [tag, count] of Object.entries(mc)) {
        if (Object.keys(misconceptions).length >= 10) break;
        misconceptions[tag] = (misconceptions[tag] || 0) + (count as number);
      }
    }

    const profileSummary = buildProfileSummary({
      level: profileRes.data?.level || "beginner",
      preferredSubject: profileRes.data?.subject || "Computer Science",
      bestStyle: activeStyle,
      misconceptions,
      topics: topicStates,
    });

    // Sanitize / cap profile summary to avoid prompt overflow
    const cappedSummary = profileSummary.slice(0, 600);

    // 5. Register background analyzer via after()
    const activeConvId = conversationId;
    const activeUserId = user.id;

    after(async () => {
      try {
        const assistantText = await assistantTextPromise;
        if (!assistantText) return;

        await analyzeConversationTurn({
          userId: activeUserId,
          conversationId: activeConvId,
          turns: [
            ...historyMessages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
            { role: "assistant", content: assistantText },
          ],
          subject: profileRes.data?.subject || "Computer Science",
        });
      } catch (analyzeErr) {
        console.error("[Background Analyzer Error]:", analyzeErr);
      }
    });

    // 6. Stream response using AI provider
    const provider = getProvider();
    const result = await provider.streamTutor(
      historyMessages,
      cappedSummary,
      activeStyle,
      async ({ text }) => {
        try {
          // Save assistant message with the style used
          const { error: saveErr } = await admin.from("messages").insert({
            conversation_id: activeConvId,
            role: "assistant",
            content: text,
            style: activeStyle,
          });
          if (saveErr) {
            console.error("[Save Assistant Message Error]:", saveErr);
          }
        } catch (saveErr) {
          console.error("[Save Assistant Message Error]:", saveErr);
        } finally {
          resolveAssistantText(text);
        }
      }
    );

    return result.toUIMessageStreamResponse({
      headers: {
        "x-conversation-id": activeConvId,
        "x-style-used": activeStyle,
      },
    });
  } catch (error: unknown) {
    // Resolve the promise on error so after() doesn't hang forever
    resolveAssistantText("");
    const err = error as Error;
    console.error("[POST /api/chat Error]:", err);
    return apiError("Internal server error", "INTERNAL_ERROR", 500);
  }
}
