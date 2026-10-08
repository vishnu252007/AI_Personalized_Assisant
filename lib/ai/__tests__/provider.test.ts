import { describe, it, expect, beforeEach } from "vitest";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { APICallError } from "ai";
import {
  FallbackProvider,
  RateLimitError,
  TimeoutError,
  ProviderError,
  classifyAndThrow,
} from "@/lib/ai/provider";
import { z } from "zod";

describe("AI Provider & Resilience (lib/ai/provider.ts)", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-gemini-key";
    process.env.GROQ_API_KEY = "test-groq-key";
  });

  describe("Error Classification", () => {
    it("classifies APICallError with statusCode 429 as RateLimitError", () => {
      const error = new APICallError({
        message: "Rate limit exceeded",
        statusCode: 429,
        url: "https://generativelanguage.googleapis.com",
        requestBodyValues: {},
      });

      expect(() => classifyAndThrow(error, "gemini")).toThrowError(RateLimitError);
    });

    it("classifies APICallError with 500+ as ProviderError", () => {
      const error = new APICallError({
        message: "Internal Server Error",
        statusCode: 503,
        url: "https://generativelanguage.googleapis.com",
        requestBodyValues: {},
      });

      expect(() => classifyAndThrow(error, "gemini")).toThrowError(ProviderError);
    });

    it("classifies DOMException TimeoutError as TimeoutError", () => {
      const error = new DOMException("The operation was aborted", "TimeoutError");
      expect(() => classifyAndThrow(error, "gemini")).toThrowError(TimeoutError);
    });

    it("classifies error message containing 429 as RateLimitError", () => {
      const error = new Error("Resource has been exhausted (e.g. check quota) 429");
      expect(() => classifyAndThrow(error, "gemini")).toThrowError(RateLimitError);
    });
  });

  describe("Stream Tutor Fallback with MockLanguageModel", () => {
    it("falls back to secondary model when primary stream fails during peek", async () => {
      // Primary model that fails immediately upon streaming
      const failingPrimary = new MockLanguageModelV3({
        doStream: async () => {
          throw new Error("Gemini quota 429 exceeded");
        },
      });

      // Secondary model that succeeds
      const successfulFallback = new MockLanguageModelV3({
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [
              { type: "text-delta", delta: "Fallback explanation from Groq." },
              {
                type: "finish",
                finishReason: "stop",
                usage: {
                  inputTokens: { total: 10 },
                  outputTokens: { total: 20 },
                },
              },
            ],
          }),
        }),
      });

      const provider = new FallbackProvider(failingPrimary, successfulFallback);

      const result = await provider.streamTutor(
        [{ role: "user", content: "Explain binary search" }],
        "profile context",
        "analogy"
      );

      // Verify stream is alive and producing text
      const chunks: string[] = [];
      for await (const chunk of result.textStream) {
        chunks.push(chunk);
      }

      expect(chunks.join("")).toContain("Fallback explanation from Groq.");
    });

    it("throws ProviderError when both primary and fallback models fail", async () => {
      const failingPrimary = new MockLanguageModelV3({
        doStream: async () => {
          throw new Error("Primary connection failure");
        },
      });

      const failingFallback = new MockLanguageModelV3({
        doStream: async () => {
          throw new Error("Secondary connection failure");
        },
      });

      const provider = new FallbackProvider(failingPrimary, failingFallback);

      await expect(
        provider.streamTutor(
          [{ role: "user", content: "Explain sliding window" }],
          "profile context",
          "steps"
        )
      ).rejects.toThrowError(ProviderError);
    });
  });

  describe("Structured Output Fallback with MockLanguageModel", () => {
    it("falls back to secondary model when primary structured generation fails", async () => {
      const failingPrimary = new MockLanguageModelV3({
        doGenerate: async () => {
          throw new Error("Primary generate failed 500");
        },
      });

      const successfulFallback = new MockLanguageModelV3({
        doGenerate: async () => ({
          content: [
            {
              type: "text",
              text: JSON.stringify({ topic: "binary-search", difficulty: 3 }),
            },
          ],
          finishReason: "stop",
          usage: {
            inputTokens: { total: 10 },
            outputTokens: { total: 10 },
          },
        }),
      });

      const provider = new FallbackProvider(failingPrimary, successfulFallback);
      const schema = z.object({
        topic: z.string(),
        difficulty: z.number(),
      });

      const result = await provider.generateStructured(
        "Analyze this topic",
        schema
      );

      expect(result).toEqual({ topic: "binary-search", difficulty: 3 });
    });
  });
});
