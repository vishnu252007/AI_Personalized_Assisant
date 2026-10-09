import { z } from "zod";
import {
  createUIMessageStreamResponse,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/ai/provider";
import { selectExplanationStyle, type StyleStat, EXPLANATION_STYLES } from "@/lib/learner/bandit";
import { buildProfileSummary } from "@/lib/learner/profile";
import { analyzeConversationTurn } from "@/lib/learner/analyzer";
import { calculateRetentionProbability, isDueForReview } from "@/lib/learner/forgetting";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser, apiError, handleRouteError } from "@/lib/api-helpers";
import { type TutorContext, type LearnerStage } from "@/lib/ai/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isValidUUID(str: string | undefined): boolean {
  return typeof str === "string" && UUID_REGEX.test(str);
}

const chatRequestSchema = z.object({
  id: z.string().optional(),
  conversationId: z.string().uuid("Invalid conversation UUID").optional(),
  message: z
    .object({
      id: z.string().optional(),
      role: z.literal("user"),
      parts: z
        .array(
          z.object({
            type: z.literal("text"),
            text: z
              .string()
              .min(1, "Message text cannot be empty")
              .max(4000, "Message text cannot exceed 4000 characters"),
          })
        )
        .min(1, "Message must contain at least one text part"),
    })
    .optional(),
  messages: z.array(z.any()).optional(),
  topicSlug: z.string().optional(),
});

export async function POST(request: Request) {
  const reqStart = Date.now();
  let authDuration = 0;
  let dbDuration = 0;

  try {
    // 1. Authenticate user
    const authStart = Date.now();
    const auth = await requireUser();
    if (auth.error) return auth.error;
    const user = auth.user;
    authDuration = Date.now() - authStart;

    // 2. Named rate limit check (chat bucket: 20 req/min)
    const rateLimit = await checkRateLimit(user.id, "chat");
    if (!rateLimit.success) {
      return apiError(
        "Rate limit exceeded. Please wait before sending more messages.",
        "RATE_LIMITED",
        429
      );
    }

    // 3. Parse and validate request body against Chat Contract
    const body = await request.json().catch(() => null);
    if (!body) {
      return apiError("Invalid JSON body", "VALIDATION_ERROR", 400);
    }

    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "Invalid chat request payload",
        "VALIDATION_ERROR",
        400,
        parsed.error.flatten()
      );
    }

    // Extract user message text according to contract
    let userText = "";
    let incomingMessageId: string | undefined;

    if (parsed.data.message) {
      userText = parsed.data.message.parts
        .map((p) => p.text)
        .join("")
        .trim();
      incomingMessageId = parsed.data.message.id;
    } else if (Array.isArray(parsed.data.messages) && parsed.data.messages.length > 0) {
      const lastMsg = [...parsed.data.messages].reverse().find((m) => m.role === "user");
      if (lastMsg) {
        if (typeof lastMsg.content === "string") {
          userText = lastMsg.content.trim();
        } else if (Array.isArray(lastMsg.parts)) {
          userText = lastMsg.parts
            .filter((p: { type: string; text?: string }) => p.type === "text" && typeof p.text === "string")
            .map((p: { text?: string }) => p.text || "")
            .join("")
            .trim();
        }
        incomingMessageId = lastMsg.id;
      }
    }

    if (!userText || userText.length > 4000) {
      return apiError(
        "User message must be between 1 and 4000 characters",
        "VALIDATION_ERROR",
        400
      );
    }

    const dbStart = Date.now();
    const supabase = await createClient();
    const admin = createAdminClient();

    // 4. Resolve or initialize conversation session
    const candidateId = parsed.data.conversationId || parsed.data.id;
    const requestedConvId = isValidUUID(candidateId) ? candidateId : undefined;
    let conversationId: string;

    if (requestedConvId) {
      const { data: conv } = await supabase
        .from("conversations")
        .select("id, user_id")
        .eq("id", requestedConvId)
        .maybeSingle();

      if (conv) {
        if (conv.user_id !== user.id) {
          return apiError("Conversation not found", "NOT_FOUND", 404);
        }
        conversationId = conv.id;
      } else {
        // Create conversation with the client-generated UUID
        const { error: convCreateErr } = await supabase
          .from("conversations")
          .insert({
            id: requestedConvId,
            user_id: user.id,
            title: userText.slice(0, 40) + "...",
          });

        if (convCreateErr) {
          console.error("[Chat] Conversation creation error:", convCreateErr);
          return apiError(
            "Failed to initialize conversation session",
            "DATABASE_ERROR",
            500
          );
        }
        conversationId = requestedConvId;
      }
    } else {
      const newConvId = crypto.randomUUID();
      const { error: convCreateErr } = await supabase
        .from("conversations")
        .insert({
          id: newConvId,
          user_id: user.id,
          title: userText.slice(0, 40) + "...",
        });

      if (convCreateErr) {
        console.error("[Chat] Conversation creation error:", convCreateErr);
        return apiError(
          "Failed to initialize conversation session",
          "DATABASE_ERROR",
          500
        );
      }
      conversationId = newConvId;
    }

    // 5. Persist the incoming user message with error check
    const { error: msgInsertErr } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: userText,
    });

    if (msgInsertErr) {
      console.error("[Chat] User message insert failed:", msgInsertErr);
      return apiError("Failed to record user message", "DATABASE_ERROR", 500);
    }

    // 6. Load authoritative conversation history from DB (never trust client history)
    const { data: dbMessages, error: histErr } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(50);

    if (histErr) {
      console.error("[Chat] History query error:", histErr);
      return apiError("Failed to load conversation history", "DATABASE_ERROR", 500);
    }

    const historyMessages = (dbMessages || []).map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    // 7. Load learner profile and calculate pedagogical adaptation
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

    // Ensure style_stats rows exist for all styles
    const existingStyles = (styleRes.data || []).map((s: { style: string }) => s.style);
    const missingStyles = EXPLANATION_STYLES.filter((s) => !existingStyles.includes(s));
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

    const activeStyle = selectExplanationStyle(
      styleStats.length > 0
        ? styleStats
        : [
            { style: "analogy", alpha: 1.0, beta: 1.0 },
            { style: "steps", alpha: 1.0, beta: 1.0 },
            { style: "example", alpha: 1.0, beta: 1.0 },
          ]
    );

    // Build learner state representation with retention probabilities
    const topicStates = (topicsRes.data || []).map(
      (t: {
        last_reviewed_at: string;
        half_life_days: number;
        mastery_score: number;
        attempts_count: number;
        topics: { name: string; slug: string } | null;
      }) => {
        const daysSince =
          Math.max(0, Date.now() - new Date(t.last_reviewed_at).getTime()) /
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
      }
    );

    const misconceptions: Record<string, number> = {};
    for (const t of topicsRes.data || []) {
      const mc = (t as { misconceptions?: Record<string, number> }).misconceptions || {};
      for (const [tag, count] of Object.entries(mc)) {
        if (Object.keys(misconceptions).length >= 10) break;
        misconceptions[tag] = (misconceptions[tag] || 0) + (count as number);
      }
    }

    const sanitizedProfileSummary = buildProfileSummary({
      level: profileRes.data?.level || "beginner",
      preferredSubject: profileRes.data?.subject || "Computer Science",
      bestStyle: activeStyle,
      misconceptions,
      topics: topicStates,
    });

    dbDuration = Date.now() - dbStart;

    // Derive learner stage from mastery or stated profile level
    const stage: LearnerStage = (() => {
      const level = profileRes.data?.level;
      if (topicStates.length > 0) {
        const avgMastery =
          topicStates.reduce((acc, t) => acc + t.masteryScore, 0) / topicStates.length;
        if (avgMastery < 0.35) return "novice";
        if (avgMastery < 0.65) return "developing";
        if (avgMastery < 0.85) return "proficient";
        return "mastered";
      }
      if (level === "advanced") return "proficient";
      if (level === "intermediate") return "developing";
      return "novice";
    })();

    const tutorContext: TutorContext = {
      stage,
      conceptName: parsed.data.topicSlug || undefined,
      misconceptions: Object.keys(misconceptions),
    };

    // 8. Stream tutor response with resilient fallback
    const aiStart = Date.now();
    const provider = getProvider();
    const streamResult = await provider.streamTutor(
      historyMessages,
      sanitizedProfileSummary,
      activeStyle,
      undefined,
      request.signal,
      tutorContext
    );
    const aiDuration = Date.now() - aiStart;

    const activeConvId = conversationId;
    const activeUserId = user.id;

    // 9. Format response via createUIMessageStreamResponse and toUIMessageStream
    const uiInputMessage: UIMessage = {
      id: incomingMessageId || crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text: userText }],
    };

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: streamResult.stream,
        originalMessages: [uiInputMessage],
        messageMetadata: ({ part }) => {
          if (part.type === "start") {
            return {
              style: activeStyle,
              conceptIds: [],
            };
          }
        },
        onEnd: async ({ messages: completedMessages }) => {
          try {
            const assistantMsg = completedMessages[completedMessages.length - 1];
            const assistantText =
              assistantMsg?.parts
                ?.filter((p): p is { type: "text"; text: string } => p.type === "text" && "text" in p && typeof (p as { text: unknown }).text === "string")
                ?.map((p) => p.text)
                ?.join("") || "";

            if (assistantText) {
              await admin.from("messages").insert({
                conversation_id: activeConvId,
                role: "assistant",
                content: assistantText,
                style: activeStyle,
              });

              // Trigger background cognitive analyzer
              try {
                analyzeConversationTurn({
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
                }).catch((analyzeErr) => {
                  console.error("[Background Analyzer Error]:", analyzeErr);
                });
              } catch (analyzeErr) {
                console.error("[Background Analyzer Error]:", analyzeErr);
              }
            }
          } catch (saveErr) {
            console.error("[Chat onEnd Assistant Message Save Error]:", saveErr);
          }
        },
        onError: () => "An error occurred while generating the tutor response.",
      }),
      headers: {
        "x-conversation-id": activeConvId,
        "x-style-used": activeStyle,
        "Server-Timing": `auth;dur=${authDuration}, db;dur=${dbDuration}, ai;dur=${aiDuration}, total;dur=${Date.now() - reqStart}`,
      },
    });
  } catch (error: unknown) {
    return handleRouteError(error, "Failed to process chat message");
  }
}
