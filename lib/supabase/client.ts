import { createBrowserClient } from "@supabase/ssr";
import { getClientEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Creates a lightweight browser Supabase client utilizing public credentials.
 * Strictly used in Client Components for reads and user-scoped chat operations.
 */
export function createClient() {
  const env = getClientEnv();

  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export const createBrowserSupabaseClient = createClient;
