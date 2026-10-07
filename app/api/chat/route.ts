import { NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/ai/provider";
import { selectExplanationStyle, type StyleStat } from "@/lib/learner/bandit";
import { buildProfileSummary } from "@/lib/learner/profile";
import { analyzeConversationTurn } from "@/lib/learner/analyzer";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const chatRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string().min(1),
    })
  ).min(1),
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

    const rateLimit = await checkRateLimit(user.id);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before sending more messages.", code: "RATE_LIMITED" },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", code: "VALIDATION_ERROR", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { messages } = parsed.data;
    let conversationId = parsed.data.conversationId;

    // 1. Resolve or create conversation
    if (!conversationId) {
      const { data: newConv, error: convErr } = await supabase
        .from("conversations")
        .insert({
          user_id: user.id,
          title: messages[messages.length - 1].content.slice(0, 40) + "...",
        })
        .select("id")
        .single();

      if (convErr || !newConv) {
        return NextResponse.json(
          { error: "Failed to initialize conversation session", code: "DATABASE_ERROR" },
          { status: 500 }
        );
      }
      conversationId = newConv.id;
    }

    // 2. Persist the incoming user message
    const latestUserMessage = messages[messages.length - 1];
    if (latestUserMessage.role === "user") {
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: latestUserMessage.content,
      });
    }

    // 3. Fetch learner profile and bandit stats
    const [profileRes, styleRes, topicsRes] = await Promise.all([
      supabase.from("profiles").select("level, subject").eq("id", user.id).maybeSingle(),
      supabase.from("style_stats").select("style, alpha, beta").eq("user_id", user.id),
      supabase.from("learner_topic_state").select("topic_id, mastery_score, half_life_days, attempts_count, last_reviewed_at, misconceptions, topics(name, slug)").eq("user_id", user.id),
    ]);

    const styleStats: StyleStat[] = (styleRes.data || []).map((s: { style: string; alpha: number; beta: number }) => ({
      style: s.style as "analogy" | "steps" | "example",
      alpha: Number(s.alpha),
      beta: Number(s.beta),
    }));

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

    // Aggregate profile summary under 150 tokens
    const profileSummary = buildProfileSummary({
      level: profileRes.data?.level || "beginner",
      preferredSubject: profileRes.data?.subject || "Computer Science",
      bestStyle: activeStyle,
      misconceptions: {},
      topics: (topicsRes.data || []).map((t: { mastery_score: number; attempts_count: number; topics: { name: string; slug: string } | null }) => ({
        name: t.topics?.name || "Topic",
        slug: t.topics?.slug || "topic",
        masteryScore: Number(t.mastery_score),
        effectiveMastery: Number(t.mastery_score),
        attemptsCount: t.attempts_count,
        retentionProbability: 1.0,
        isDueForReview: false,
      })),
    });

    // 4. Set up background analyzer promise and registration via after()
    const activeConvId = conversationId;
    const activeUserId = user.id;

    let resolveAssistantText: (text: string) => void = () => {};
    const assistantTextPromise = new Promise<string>((resolve) => {
      resolveAssistantText = resolve;
    });

    // Run lib/learner/analyzer.ts via after() from next/server (direct function call)
    after(async () => {
      try {
        const assistantText = await assistantTextPromise;
        if (!assistantText) return;

        await analyzeConversationTurn({
          userId: activeUserId,
          conversationId: activeConvId,
          turns: [
            ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
            { role: "assistant", content: assistantText },
          ],
          subject: profileRes.data?.subject || "Computer Science",
        });
      } catch (analyzeErr) {
        console.error("[Background Analyzer Error]:", analyzeErr);
      }
    });

    // 5. Stream response using AI provider
    const provider = getProvider();
    const result = await provider.streamTutor(
      messages.map((m) => ({ role: m.role, content: m.content })),
      profileSummary,
      activeStyle,
      async ({ text }) => {
        try {
          // Save assistant message in onFinish with the style used
          const admin = createAdminClient();
          await admin.from("messages").insert({
            conversation_id: activeConvId,
            role: "assistant",
            content: text,
          });
        } catch (saveErr) {
          console.error("[Save Assistant Message Error]:", saveErr);
        } finally {
          resolveAssistantText(text);
        }
      }
    );

    return result.toTextStreamResponse({
      headers: {
        "x-conversation-id": activeConvId,
        "x-style-used": activeStyle,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[POST /api/chat Error]:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
