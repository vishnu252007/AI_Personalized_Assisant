import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const deleteConversationSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID"),
});

export async function GET() {
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

    const { data: conversations, error } = await supabase
      .from("conversations")
      .select("id, title, topic_id, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch conversations", code: "DATABASE_ERROR" },
        { status: 500 }
      );
    }

    return NextResponse.json({ conversations: conversations || [] });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[GET /api/conversations Error]:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to list conversations", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const conversationId = searchParams.get("id") || body.conversationId;

    const parsed = deleteConversationSchema.safeParse({ conversationId });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid conversation ID", code: "VALIDATION_ERROR", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from("conversations")
      .delete()
      .eq("id", parsed.data.conversationId)
      .eq("user_id", user.id);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete conversation", code: "DATABASE_ERROR" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, deletedId: parsed.data.conversationId });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[DELETE /api/conversations Error]:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to delete conversation", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
