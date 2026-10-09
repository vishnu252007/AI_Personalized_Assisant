import "server-only";

import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import {
  streamText,
  generateText,
  APICallError,
  Output,
  toTextStream,
  toUIMessageStream,
  createUIMessageStreamResponse,
  type LanguageModel,
  type TextStreamPart,
} from "ai";
import { z } from "zod";
import { getServerEnv } from "@/lib/env.server";
import { buildSocraticTutorPrompt, type TutorContext } from "./prompts";

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

export interface TutorStreamResult {
  stream: ReadableStream<TextStreamPart<any>>;
  textStream: ReadableStream<string> & AsyncIterable<string>;
  toUIMessageStreamResponse?: (options?: Record<string, unknown>) => Response;
}

export interface AIProviderInterface {
  streamTutor(
    messages: TutorMessage[],
    profileContext: string,
    style?: string,
    onFinish?: (event: { text: string }) => Promise<void> | void,
    abortSignal?: AbortSignal,
    tutorContext?: TutorContext
  ): Promise<TutorStreamResult>;

  generateStructured<T>(
    prompt: string,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    systemPrompt?: string,
    abortSignal?: AbortSignal
  ): Promise<T>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;

function createCompositeSignal(
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  callerSignal?: AbortSignal
): AbortSignal {
  const timeoutSig = AbortSignal.timeout(timeoutMs);
  if (!callerSignal) return timeoutSig;

  const abortSignalConstructor = AbortSignal as unknown as {
    any?: (signals: AbortSignal[]) => AbortSignal;
  };
  if (typeof abortSignalConstructor.any === "function") {
    return abortSignalConstructor.any([timeoutSig, callerSignal]);
  }

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  callerSignal.addEventListener("abort", onAbort, { once: true });
  timeoutSig.addEventListener("abort", onAbort, { once: true });
  return controller.signal;
}

export function classifyAndThrow(err: unknown, provider: string): never {
  if (err instanceof DOMException && err.name === "TimeoutError") {
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

  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
    throw new RateLimitError(`${provider} rate limit exceeded`, provider);
  }

  throw new ProviderError(`${provider} provider error`, provider, err);
}

/**
 * Buffers chunks from streamText until the first text-delta or error.
 * If an error occurs or stream finishes without producing any text-delta, throws so fallback triggers.
 * If successful, returns a reconstructed stream yielding all buffered chunks followed by remaining chunks.
 */
async function peekAndBufferStream(
  streamResult: ReturnType<typeof streamText>
): Promise<{
  stream: ReadableStream<TextStreamPart<any>>;
  textStream: ReadableStream<string> & AsyncIterable<string>;
}> {
  const reader = streamResult.stream.getReader();
  const bufferedChunks: TextStreamPart<any>[] = [];
  let foundFirstTextDelta = false;
  let streamError: unknown = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      bufferedChunks.push(value);
      if (value.type === "error") {
        streamError = (value as any).error;
        break;
      }
      if (value.type === "text-delta") {
        foundFirstTextDelta = true;
        break;
      }
    }
  }

  if (!foundFirstTextDelta || streamError) {
    await reader.cancel("Stream failed before first text-delta").catch(() => {});
    throw streamError || new Error("Stream closed before first text-delta");
  }

  const combinedStream = new ReadableStream<TextStreamPart<any>>({
    start(controller) {
      for (const chunk of bufferedChunks) {
        controller.enqueue(chunk);
      }
    },
    async pull(controller) {
      try {
        const { value, done } = await reader.read();
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch (err) {
        controller.error(err);
      }
    },
    cancel(reason) {
      reader.cancel(reason);
    },
  });

  const [streamForUI, streamForText] = combinedStream.tee();
  return {
    stream: streamForUI,
    textStream: toTextStream({ stream: streamForText }) as ReadableStream<string> &
      AsyncIterable<string>,
  };
}

// ── CloudProvider ──────────────────────────────────────────────────────────────

export class CloudProvider implements AIProviderInterface {
  constructor(private customModel?: LanguageModel) {}

  private getModel(): LanguageModel {
    if (this.customModel) return this.customModel;
    const env = getServerEnv();
    return google(env.GEMINI_MODEL);
  }

  async streamTutor(
    messages: TutorMessage[],
    profileContext: string,
    style: string = "analogy",
    onFinish?: (event: { text: string }) => Promise<void> | void,
    abortSignal?: AbortSignal,
    tutorContext?: TutorContext
  ): Promise<TutorStreamResult> {
    const instructions = buildSocraticTutorPrompt(profileContext, style, tutorContext);
    const signal = createCompositeSignal(DEFAULT_TIMEOUT_MS, abortSignal);

    const result = streamText({
      model: this.getModel(),
      instructions,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: 0.7,
      maxRetries: 0,
      abortSignal: signal,
      onFinish: onFinish
        ? async (event) => {
            await onFinish({ text: event.text });
          }
        : undefined,
    });

    const buffered = await peekAndBufferStream(result);

    return {
      stream: buffered.stream,
      textStream: buffered.textStream,
      toUIMessageStreamResponse: (options?: any) =>
        createUIMessageStreamResponse({
          stream: toUIMessageStream({
            stream: buffered.stream,
            ...options,
          }),
          headers: options?.headers,
        }),
    };
  }

  async generateStructured<T>(
    prompt: string,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    systemPrompt?: string,
    abortSignal?: AbortSignal
  ): Promise<T> {
    const signal = createCompositeSignal(DEFAULT_TIMEOUT_MS, abortSignal);

    const { output } = await generateText({
      model: this.getModel(),
      instructions: systemPrompt,
      prompt,
      temperature: 0.2,
      maxRetries: 0,
      abortSignal: signal,
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
    private primaryModel?: LanguageModel,
    private fallbackModel?: LanguageModel
  ) {
    this.primary = new CloudProvider(primaryModel);
  }

  private getGroqModel(): LanguageModel {
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
    onFinish?: (event: { text: string }) => Promise<void> | void,
    abortSignal?: AbortSignal,
    tutorContext?: TutorContext
  ): Promise<TutorStreamResult> {
    const instructions = buildSocraticTutorPrompt(profileContext, style, tutorContext);
    const signal = createCompositeSignal(DEFAULT_TIMEOUT_MS, abortSignal);

    // 1. Attempt primary stream with buffering
    try {
      const primaryResult = streamText({
        model: this.primaryModel || google(getServerEnv().GEMINI_MODEL),
        instructions,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: 0.7,
        maxRetries: 0,
        abortSignal: signal,
        onFinish: onFinish
          ? async (event) => {
              await onFinish({ text: event.text });
            }
          : undefined,
      });

      const buffered = await peekAndBufferStream(primaryResult);
      return {
        stream: buffered.stream,
        textStream: buffered.textStream,
        toUIMessageStreamResponse: (options?: any) =>
          createUIMessageStreamResponse({
            stream: toUIMessageStream({
              stream: buffered.stream,
              ...options,
            }),
            headers: options?.headers,
          }),
      };
    } catch (primaryErr: unknown) {
      let primaryClassified: Error;
      try {
        classifyAndThrow(primaryErr, "gemini");
      } catch (e) {
        primaryClassified = e as Error;
      }

      const env = getServerEnv();
      if (this.fallbackModel || env.GROQ_API_KEY) {
        try {
          const fallbackResult = streamText({
            model: this.getGroqModel(),
            instructions,
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            temperature: 0.7,
            maxRetries: 0,
            abortSignal: signal,
            onFinish: onFinish
              ? async (event) => {
                  await onFinish({ text: event.text });
                }
              : undefined,
          });

          const bufferedFallback = await peekAndBufferStream(fallbackResult);
          return {
            stream: bufferedFallback.stream,
            textStream: bufferedFallback.textStream,
            toUIMessageStreamResponse: (options?: any) =>
              createUIMessageStreamResponse({
                stream: toUIMessageStream({
                  stream: bufferedFallback.stream,
                  ...options,
                }),
                headers: options?.headers,
              }),
          };
        } catch (fallbackErr: unknown) {
          throw new ProviderError(
            "Both primary and fallback AI providers failed streamTutor",
            "fallback",
            fallbackErr
          );
        }
      }

      throw primaryClassified!;
    }
  }

  async generateStructured<T>(
    prompt: string,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    systemPrompt?: string,
    abortSignal?: AbortSignal
  ): Promise<T> {
    try {
      return await this.primary.generateStructured(prompt, schema, systemPrompt, abortSignal);
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
          const signal = createCompositeSignal(DEFAULT_TIMEOUT_MS, abortSignal);
          const { output } = await generateText({
            model: this.getGroqModel(),
            instructions: systemPrompt,
            prompt,
            temperature: 0.2,
            maxRetries: 0,
            abortSignal: signal,
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

export function _setProvider(provider: AIProviderInterface | null): void {
  activeProvider = provider;
}
