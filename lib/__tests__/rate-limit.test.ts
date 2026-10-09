import { describe, it, expect } from "vitest";
import { checkRateLimit, BUCKET_CONFIG } from "@/lib/rate-limit";

describe("Named Rate-Limit Buckets (lib/rate-limit.ts)", () => {
  it("defines correct capacities for named buckets", () => {
    expect(BUCKET_CONFIG.chat.limit).toBe(20);
    expect(BUCKET_CONFIG.quizGenerate.limit).toBe(5);
  });

  it("permits requests within limits for chat bucket", async () => {
    const userId = "test-user-chat-1";
    const res = await checkRateLimit(userId, "chat");
    expect(res.success).toBe(true);
    expect(res.limit).toBe(20);
    expect(res.remaining).toBe(19);
  });

  it("exhausts quizGenerate bucket after 5 calls", async () => {
    const userId = "test-user-quiz-exhaust";
    for (let i = 0; i < 5; i++) {
      const res = await checkRateLimit(userId, "quizGenerate");
      expect(res.success).toBe(true);
    }
    const sixth = await checkRateLimit(userId, "quizGenerate");
    expect(sixth.success).toBe(false);
    expect(sixth.remaining).toBe(0);
  });
});
