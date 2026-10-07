import "server-only";

import { z } from "zod";
import {
  clientEnvSchema,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GROQ_MODEL,
  formatEnvErrors,
} from "./env";

/**
 * Server Environment Variable Schema.
 * Extends client variables with sensitive secrets and server configurations.
 */
export const serverEnvSchema = clientEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1, "GOOGLE_GENERATIVE_AI_API_KEY is required"),
  GEMINI_MODEL: z.string().default(DEFAULT_GEMINI_MODEL),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default(DEFAULT_GROQ_MODEL),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedServerEnv: ServerEnv | null = null;

/**
 * Validates and returns server environment variables.
 * Throws a clear error listing all missing/invalid variables in ALL environments.
 * No placeholder fallbacks are permitted.
 */
export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  const result = serverEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  if (!result.success) {
    const formattedErrors = formatEnvErrors(result.error.flatten().fieldErrors);
    throw new Error(
      `[LearnAI Environment Error] Server environment variable validation failed:\n${formattedErrors}\n` +
      `Ensure all required server variables are defined in your environment or .env.local file.`
    );
  }

  cachedServerEnv = result.data;
  return cachedServerEnv;
}

/**
 * Test helper to reset cached server environment variables.
 */
export function _resetServerEnvCache(): void {
  cachedServerEnv = null;
}

export const serverEnv = getServerEnv;
