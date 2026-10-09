import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitBucket = "chat" | "quizGenerate" | "default";

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export const BUCKET_CONFIG: Record<
  RateLimitBucket,
  { limit: number; windowMs: number; redisWindow: "1 m" }
> = {
  chat: { limit: 20, windowMs: 60 * 1000, redisWindow: "1 m" },
  quizGenerate: { limit: 5, windowMs: 60 * 1000, redisWindow: "1 m" },
  default: { limit: 20, windowMs: 60 * 1000, redisWindow: "1 m" },
};

// In-memory token bucket store for local development / fallback
interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const memoryStore = new Map<string, TokenBucket>();

function checkMemoryRateLimit(
  identifier: string,
  bucket: RateLimitBucket
): RateLimitResult {
  const config = BUCKET_CONFIG[bucket] || BUCKET_CONFIG.default;
  const storeKey = `${bucket}:${identifier}`;
  const now = Date.now();
  let item = memoryStore.get(storeKey);

  if (!item) {
    item = { tokens: config.limit, lastRefill: now };
    memoryStore.set(storeKey, item);
  } else {
    const elapsed = now - item.lastRefill;
    if (elapsed > config.windowMs) {
      item.tokens = config.limit;
      item.lastRefill = now;
    }
  }

  if (item.tokens > 0) {
    item.tokens -= 1;
    return {
      success: true,
      limit: config.limit,
      remaining: item.tokens,
      reset: item.lastRefill + config.windowMs,
    };
  }

  return {
    success: false,
    limit: config.limit,
    remaining: 0,
    reset: item.lastRefill + config.windowMs,
  };
}

const redisRatelimitMap = new Map<RateLimitBucket, Ratelimit>();

function getRedisRatelimit(bucket: RateLimitBucket): Ratelimit | null {
  if (redisRatelimitMap.has(bucket)) {
    return redisRatelimitMap.get(bucket)!;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      const config = BUCKET_CONFIG[bucket] || BUCKET_CONFIG.default;
      const redis = new Redis({ url, token });
      const limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(config.limit, config.redisWindow),
        prefix: `learnai:${bucket}`,
        analytics: true,
      });
      redisRatelimitMap.set(bucket, limiter);
      return limiter;
    } catch (err) {
      console.warn(
        `[LearnAI RateLimit] Failed to initialize Redis rate limiter for bucket ${bucket}:`,
        err
      );
    }
  }

  return null;
}

/**
 * Checks rate limit for a user ID with named rate-limit buckets:
 * - "chat": 20 requests / min
 * - "quizGenerate": 5 requests / min
 * - "default": 20 requests / min
 */
export async function checkRateLimit(
  identifier: string,
  bucket: RateLimitBucket = "chat"
): Promise<RateLimitResult> {
  const limiter = getRedisRatelimit(bucket);
  if (limiter) {
    try {
      const result = await limiter.limit(identifier);
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
      };
    } catch (err) {
      console.warn(
        `[LearnAI RateLimit] Redis error on bucket ${bucket}, falling back to memory:`,
        err
      );
    }
  }

  return checkMemoryRateLimit(identifier, bucket);
}
