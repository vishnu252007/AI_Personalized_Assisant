import "server-only";

import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { streamText, generateObject, type ModelMessage } from "ai";
import { z } from "zod";
import { getServerEnv } from "@/lib/env.server";
import { buildSocraticTutorPrompt } from "./prompts";

/**
 * Custom Typed AI Errors per Blueprint v2 Section 3.6.
 */
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
  constructor(message: string, public readonly provider: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ProviderError";
  }
}

export type TutorMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export interface AIProviderInterface {
  streamTutor(
    messages: TutorMessage[],
    profileContext: string,
    style?: string,
    onFinish?: (event: { text: string }) => Promise<void> | void
  ): Promise<ReturnType<typeof streamText>>;

  generateStructured<T>(
    prompt: string,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    systemPrompt?: string
  ): Promise<T>;
}

/**
 * Utility to retry an async operation with exponential backoff.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: unknown) {
      attempt++;
      if (attempt >= retries) {
        throw err;
      }
      const backoff = delayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
}

/**
 * Primary Cloud Provider using Google Gemini.
 */
export class CloudProvider implements AIProviderInterface {
  private getModel() {
    const env = getServerEnv();
    return google(env.GEMINI_MODEL);
  }

  async streamTutor(
    messages: TutorMessage[],
    profileContext: string,
    style: string = "analogy",
    onFinish?: (event: { text: string }) => Promise<void> | void
  ): Promise<ReturnType<typeof streamText>> {
    const system = buildSocraticTutorPrompt(profileContext, style);
    return streamText({
      model: this.getModel(),
      system,
      messages: messages as unknown as ModelMessage[],
      temperature: 0.7,
      onFinish: onFinish ? async (event) => { await onFinish({ text: event.text }); } : undefined,
    });
  }

  async generateStructured<T>(
    prompt: string,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    systemPrompt?: string
  ): Promise<T> {
    const { object } = await generateObject({
      model: this.getModel(),
      system: systemPrompt,
      prompt,
      schema: schema as unknown as z.ZodType<T>,
      temperature: 0.2,
    });
    return object as T;
  }
}

/**
 * Fallback Provider: tries Gemini first, falls back to Groq on rate limit or provider error.
 * Includes exponential backoff with up to 3 automatic retries.
 */
export class FallbackProvider implements AIProviderInterface {
  private primary: CloudProvider;

  constructor() {
    this.primary = new CloudProvider();
  }

  private getGroqModel() {
    const env = getServerEnv();
    if (!env.GROQ_API_KEY) {
      throw new ProviderError("Groq fallback invoked but GROQ_API_KEY is not configured", "groq");
    }
    return groq(env.GROQ_MODEL);
  }

  async streamTutor(
    messages: TutorMessage[],
    profileContext: string,
    style: string = "analogy",
    onFinish?: (event: { text: string }) => Promise<void> | void
  ): Promise<ReturnType<typeof streamText>> {
    try {
      return await withRetry(() => this.primary.streamTutor(messages, profileContext, style, onFinish), 2);
    } catch (primaryErr: unknown) {
      const err = primaryErr as { message?: string; status?: number };
      const isRateLimit = err?.message?.includes("429") || err?.status === 429;
      const env = getServerEnv();

      if (env.GROQ_API_KEY) {
        try {
          const system = buildSocraticTutorPrompt(profileContext, style);
          return await streamText({
            model: this.getGroqModel(),
            system,
            messages: messages as unknown as ModelMessage[],
            temperature: 0.7,
            onFinish: onFinish ? async (event) => { await onFinish({ text: event.text }); } : undefined,
          });
        } catch (fallbackErr: unknown) {
          throw new ProviderError("Both primary and fallback AI providers failed streamTutor", "fallback", fallbackErr);
        }
      }

      if (isRateLimit) {
        throw new RateLimitError("Gemini rate limit exceeded and no Groq fallback available", "gemini");
      }
      throw new ProviderError("Primary AI provider failed streamTutor", "gemini", primaryErr);
    }
  }

  async generateStructured<T>(
    prompt: string,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    systemPrompt?: string
  ): Promise<T> {
    try {
      return await withRetry(() => this.primary.generateStructured(prompt, schema, systemPrompt), 2);
    } catch (primaryErr: unknown) {
      const err = primaryErr as { message?: string; status?: number };
      const isRateLimit = err?.message?.includes("429") || err?.status === 429;
      const env = getServerEnv();

      if (env.GROQ_API_KEY) {
        try {
          const { object } = await generateObject({
            model: this.getGroqModel(),
            system: systemPrompt,
            prompt,
            schema: schema as unknown as z.ZodType<T>,
            temperature: 0.2,
          });
          return object as T;
        } catch (fallbackErr: unknown) {
          throw new ProviderError("Both primary and fallback AI providers failed generateStructured", "fallback", fallbackErr);
        }
      }

      if (isRateLimit) {
        throw new RateLimitError("Gemini rate limit exceeded and no Groq fallback available", "gemini");
      }
      throw new ProviderError("Primary AI provider failed generateStructured", "gemini", primaryErr);
    }
  }
}

let activeProvider: AIProviderInterface | null = null;

export function getProvider(): AIProviderInterface {
  if (!activeProvider) {
    activeProvider = new FallbackProvider();
  }
  return activeProvider;
}
