import { z } from "zod";

/**
 * Default AI Model Identifiers defined centrally once for reuse across client/server.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash" as const;
export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile" as const;

export const DEFAULT_MODEL_IDS = {
  gemini: DEFAULT_GEMINI_MODEL,
  groq: DEFAULT_GROQ_MODEL,
} as const;

/**
 * Client Environment Variable Schema.
 * Only public variables exposed to the browser.
 * NEXT_PUBLIC_SITE_URL is strictly required in production without fallback.
 */
export const clientEnvSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
    NEXT_PUBLIC_SITE_URL: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction && !data.NEXT_PUBLIC_SITE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NEXT_PUBLIC_SITE_URL"],
        message: "NEXT_PUBLIC_SITE_URL is required in production",
      });
      return;
    }

    if (data.NEXT_PUBLIC_SITE_URL) {
      try {
        new URL(data.NEXT_PUBLIC_SITE_URL);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["NEXT_PUBLIC_SITE_URL"],
          message: "NEXT_PUBLIC_SITE_URL must be a valid URL",
        });
      }
    }
  });

export type ClientEnv = z.infer<typeof clientEnvSchema> & {
  NEXT_PUBLIC_SITE_URL: string;
};

/**
 * Format field errors into a readable bulleted list.
 */
export function formatEnvErrors(errors: Record<string, string[] | undefined>): string {
  return Object.entries(errors)
    .filter(([, msgs]) => msgs && msgs.length > 0)
    .map(([field, msgs]) => `  - ${field}: ${msgs!.join(", ")}`)
    .join("\n");
}

let cachedClientEnv: ClientEnv | null = null;

/**
 * Validates and returns client environment variables.
 * Throws a clear error listing all missing/invalid variables in ALL environments.
 * No placeholder fallbacks are permitted in production.
 */
export function getClientEnv(): ClientEnv {
  if (cachedClientEnv) {
    return cachedClientEnv;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const defaultSiteUrl = isProduction ? undefined : "http://localhost:3000";
  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || defaultSiteUrl;

  const result = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: rawSiteUrl,
  });

  if (!result.success) {
    const formattedErrors = formatEnvErrors(result.error.flatten().fieldErrors);
    throw new Error(
      `[LearnAI Environment Error] Client environment variable validation failed:\n${formattedErrors}\n` +
      `Ensure all required client variables are defined in your environment or .env.local file.`
    );
  }

  cachedClientEnv = {
    ...result.data,
    NEXT_PUBLIC_SITE_URL: result.data.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  };
  return cachedClientEnv;
}

/**
 * Test helper to reset cached client environment variables.
 */
export function _resetClientEnvCache(): void {
  cachedClientEnv = null;
}

export const env = {
  client: getClientEnv,
};
