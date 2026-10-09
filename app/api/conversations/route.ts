import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser, apiError, handleRouteError } from "@/lib/api-helpers";

export const runtime = "nodejs";

const deleteConversationSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID"),
});

export async function GET() {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;
    const user = auth.user;

    const supabase = await createClient();
    const { data: conversations, error } = await supabase
      .from("conversations")
      .select("id, title, topic_id, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      return apiError("Failed to fetch conversations", "DATABASE_ERROR", 500);
    }

    return NextResponse.json({ conversations: conversations || [] });
  } catch (error: unknown) {
    return handleRouteError(error, "Failed to list conversations");
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;
    const user = auth.user;

    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const conversationId = searchParams.get("id") || body.conversationId;

    const parsed = deleteConversationSchema.safeParse({ conversationId });
    if (!parsed.success) {
      return apiError(
        "Invalid conversation ID",
        "VALIDATION_ERROR",
        400,
        parsed.error.flatten()
      );
    }

    const supabase = await createClient();
    const { error: deleteError } = await supabase
      .from("conversations")
      .delete()
      .eq("id", parsed.data.conversationId)
      .eq("user_id", user.id);

    if (deleteError) {
      return apiError("Failed to delete conversation", "DATABASE_ERROR", 500);
    }

    return NextResponse.json({ success: true, deletedId: parsed.data.conversationId });
  } catch (error: unknown) {
    return handleRouteError(error, "Failed to delete conversation");
  }
}
