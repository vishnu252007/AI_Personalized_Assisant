import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser, apiError, handleRouteError } from "@/lib/api-helpers";

export const runtime = "nodejs";

const paramsSchema = z.object({
  id: z.string().uuid("Invalid conversation UUID"),
});

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;
    const user = auth.user;
    const authDuration = Date.now() - startTime;

    const rawParams = await props.params;
    const parsed = paramsSchema.safeParse(rawParams);
    if (!parsed.success) {
      return apiError(
        "Invalid conversation ID format",
        "VALIDATION_ERROR",
        400,
        parsed.error.flatten()
      );
    }
    const conversationId = parsed.data.id;

    const dbStart = Date.now();
    const supabase = await createClient();

    // 1. Verify ownership
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("id, title, topic_id, created_at, updated_at")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (convErr || !conv) {
      return apiError("Conversation not found", "NOT_FOUND", 404);
    }

    // 2. Load messages ordered chronologically
    const { data: dbMessages, error: msgErr } = await supabase
      .from("messages")
      .select("id, role, content, style, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (msgErr) {
      return apiError("Failed to load conversation messages", "DATABASE_ERROR", 500);
    }

    const dbDuration = Date.now() - dbStart;

    // 3. Shape into UI message objects
    const messages = (dbMessages || []).map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant" | "system",
      parts: [
        {
          type: "text" as const,
          text: m.content,
        },
      ],
      createdAt: new Date(m.created_at).getTime(),
      metadata: m.style ? { style: m.style } : undefined,
    }));

    return NextResponse.json(
      {
        conversationId: conv.id,
        title: conv.title,
        messages,
      },
      {
        headers: {
          "Server-Timing": `auth;dur=${authDuration}, db;dur=${dbDuration}`,
        },
      }
    );
  } catch (error: unknown) {
    return handleRouteError(error, "Failed to load conversation");
  }
}
