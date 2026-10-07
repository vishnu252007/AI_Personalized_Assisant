import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env.server";
import type { Database } from "@/types/database";

/**
 * Creates an administrative, server-only Supabase client leveraging the service_role key.
 * Strictly restricted to trusted backend processes (quiz generation, attempt grading, Elo & spaced repetition updates).
 * Session persistence is disabled.
 */
export function createAdminClient() {
  const env = getServerEnv();

  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

export const getAdminClient = createAdminClient;
