import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, handleRouteError } from "@/lib/api-helpers";
import { getOrCreateDailyPlan } from "@/lib/learner/engine-v2";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;
    const user = auth.user;

    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date") || new Date().toISOString().split("T")[0];

    const admin = createAdminClient();
    const planItems = await getOrCreateDailyPlan(admin, user.id, dateParam);

    return Response.json({
      date: dateParam,
      items: planItems,
      totalMinutes: planItems.reduce((acc, i) => acc + i.estMinutes, 0),
    });
  } catch (error: unknown) {
    return handleRouteError(error, "Failed to retrieve daily plan");
  }
}
