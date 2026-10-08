import "server-only";

import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import {
  streamText,
  generateText,
  APICallError,
  Output,
  type LanguageModel,
} from "ai";
import { z } from "zod";
import { getServerEnv } from "@/lib/env.server";
import { buildSocraticTutorPrompt } from "./prompts";

// ── Custom errors ──────────────────────────────────────────────────────────────

export class RateLimitError extends Error {
  constructor(message: string, public readonly provider: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

export class TimeoutError extends Error {
  constructor(message: string, public readonly provider: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type TutorMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type TutorStreamResult = ReturnType<typeof streamText>;

export interface AIProviderInterface {
  streamTutor(
    messages: TutorMessage[],
    profileContext: string,
    style?: string,
    onFinish?: (event: { text: string }) => Promise<void> | void
  ): Promise<TutorStreamResult>;

  generateStructured<T>(
    prompt: string,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    systemPrompt?: string
  ): Promise<T>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Creates an AbortSignal that fires after `ms` milliseconds.
 */
function timeoutSignal(ms: number = DEFAULT_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(ms);
}

/**
 * Classifies an error as rate-limit (429), timeout, or generic provider error.
 */
export function classifyAndThrow(err: unknown, provider: string): never {
  // AbortSignal.timeout throws a DOMException / TimeoutError
  if (
    err instanceof DOMException &&
    err.name === "TimeoutError"
  ) {
    throw new TimeoutError(`${provider} request timed out`, provider);
  }

  if (err instanceof APICallError) {
    if (err.statusCode === 429) {
      throw new RateLimitError(`${provider} rate limit exceeded (429)`, provider);
    }
    if (err.statusCode !== undefined && err.statusCode >= 500) {
      throw new ProviderError(`${provider} server error (${err.statusCode})`, provider, err);
    }
  }

  // String-based detection for non-APICallError or wrapped error messages
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("429")) {
    throw new RateLimitError(`${provider} rate limit exceeded`, provider);
  }

  throw new ProviderError(`${provider} provider error`, provider, err);
}

/**
 * Peek-validates a stream by consuming the very first chunk.
 * If the first chunk fails (provider error / empty stream), the error propagates
 * immediately so the caller can switch to the fallback.
 */
export async function peekFirstChunk(result: TutorStreamResult): Promise<void> {
  for await (const part of result.fullStream) {
    if (part.type === "error") {
      throw part.error;
    }
    if (part.type === "text-delta" || part.type === "finish") {
      return;
    }
  }
}

// ── CloudProvider ──────────────────────────────────────────────────────────────

export class CloudProvider implements AIProviderInterface {
  constructor(private customModel?: LanguageModel) {}

  private getModel() {
    if (this.customModel) return this.customModel;
    const env = getServerEnv();
    return google(env.GEMINI_MODEL);
  }

  async streamTutor(
    messages: TutorMessage[],
    profileContext: string,
    style: string = "analogy",
    onFinish?: (event: { text: string }) => Promise<void> | void
  ): Promise<TutorStreamResult> {
    const system = buildSocraticTutorPrompt(profileContext, style);
    const result = streamText({
      model: this.getModel(),
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: 0.7,
      maxRetries: 0,
      abortSignal: timeoutSignal(),
      onFinish: onFinish
        ? async (event) => {
            await onFinish({ text: event.text });
          }
        : undefined,
    });

    return result;
  }

  async generateStructured<T>(
    prompt: string,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    systemPrompt?: string
  ): Promise<T> {
    const { output } = await generateText({
      model: this.getModel(),
      system: systemPrompt,
      prompt,
      temperature: 0.2,
      maxRetries: 0,
      abortSignal: timeoutSignal(),
      output: Output.object({
        schema,
      }),
    });

    return output as T;
  }
}

// ── FallbackProvider ───────────────────────────────────────────────────────────

export class FallbackProvider implements AIProviderInterface {
  private primary: CloudProvider;

  constructor(
    primaryModel?: LanguageModel,
    private fallbackModel?: LanguageModel
  ) {
    this.primary = new CloudProvider(primaryModel);
  }

  private getGroqModel() {
    if (this.fallbackModel) return this.fallbackModel;
    const env = getServerEnv();
    if (!env.GROQ_API_KEY) {
      throw new ProviderError(
        "Groq fallback invoked but GROQ_API_KEY is not configured",
        "groq"
      );
    }
    return groq(env.GROQ_MODEL);
  }

  async streamTutor(
    messages: TutorMessage[],
    profileContext: string,
    style: string = "analogy",
    onFinish?: (event: { text: string }) => Promise<void> | void
  ): Promise<TutorStreamResult> {
    try {
      const result = await this.primary.streamTutor(
        messages,
        profileContext,
        style,
        onFinish
      );

      // Peek-validate: consume first chunk to verify the stream is alive.
      await peekFirstChunk(result);
      return result;
    } catch (primaryErr: unknown) {
      // Classify and wrap the primary error
      let classified: Error;
      try {
        classifyAndThrow(primaryErr, "gemini");
      } catch (e) {
        classified = e as Error;
      }

      const env = getServerEnv();
      if (this.fallbackModel || env.GROQ_API_KEY) {
        try {
          const system = buildSocraticTutorPrompt(profileContext, style);
          const result = streamText({
            model: this.getGroqModel(),
            system,
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            temperature: 0.7,
            maxRetries: 0,
            abortSignal: timeoutSignal(),
            onFinish: onFinish
              ? async (event) => {
                  await onFinish({ text: event.text });
                }
              : undefined,
          });

          // Peek-validate fallback stream too
          await peekFirstChunk(result);
          return result;
        } catch (fallbackErr: unknown) {
          throw new ProviderError(
            "Both primary and fallback AI providers failed streamTutor",
            "fallback",
            fallbackErr
          );
        }
      }

      throw classified!;
    }
  }

  async generateStructured<T>(
    prompt: string,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    systemPrompt?: string
  ): Promise<T> {
    try {
      return await this.primary.generateStructured(prompt, schema, systemPrompt);
    } catch (primaryErr: unknown) {
      let classified: Error;
      try {
        classifyAndThrow(primaryErr, "gemini");
      } catch (e) {
        classified = e as Error;
      }

      const env = getServerEnv();
      if (this.fallbackModel || env.GROQ_API_KEY) {
        try {
          const { output } = await generateText({
            model: this.getGroqModel(),
            system: systemPrompt,
            prompt,
            temperature: 0.2,
            maxRetries: 0,
            abortSignal: timeoutSignal(),
            output: Output.object({
              schema,
            }),
          });

          return output as T;
        } catch (fallbackErr: unknown) {
          throw new ProviderError(
            "Both primary and fallback AI providers failed generateStructured",
            "fallback",
            fallbackErr
          );
        }
      }

      throw classified!;
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────────

let activeProvider: AIProviderInterface | null = null;

export function getProvider(): AIProviderInterface {
  if (!activeProvider) {
    activeProvider = new FallbackProvider();
  }
  return activeProvider;
}

/**
 * Test helper: replace the active provider with a mock.
 */
export function _setProvider(provider: AIProviderInterface | null): void {
  activeProvider = provider;
}
