import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

// In-memory sliding window fallback for local development
interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const memoryStore = new Map<string, TokenBucket>();
const MEMORY_CAPACITY = 20; // 20 requests
const REFILL_RATE_MS = 60 * 1000; // per minute

function checkMemoryRateLimit(identifier: string): RateLimitResult {
  const now = Date.now();
  let bucket = memoryStore.get(identifier);

  if (!bucket) {
    bucket = { tokens: MEMORY_CAPACITY, lastRefill: now };
    memoryStore.set(identifier, bucket);
  } else {
    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    if (elapsed > REFILL_RATE_MS) {
      bucket.tokens = MEMORY_CAPACITY;
      bucket.lastRefill = now;
    }
  }

  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    return {
      success: true,
      limit: MEMORY_CAPACITY,
      remaining: bucket.tokens,
      reset: bucket.lastRefill + REFILL_RATE_MS,
    };
  }

  return {
    success: false,
    limit: MEMORY_CAPACITY,
    remaining: 0,
    reset: bucket.lastRefill + REFILL_RATE_MS,
  };
}

let redisRatelimit: Ratelimit | null = null;

function getRedisRatelimit(): Ratelimit | null {
  if (redisRatelimit) return redisRatelimit;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      const redis = new Redis({ url, token });
      redisRatelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, "1 m"),
        analytics: true,
      });
      return redisRatelimit;
    } catch (err) {
      console.warn("[LearnAI RateLimit] Failed to initialize Redis rate limiter, using in-memory:", err);
    }
  }

  return null;
}

/**
 * Checks rate limit for a user ID or IP address.
 */
export async function checkRateLimit(identifier: string): Promise<RateLimitResult> {
  const limiter = getRedisRatelimit();
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
      console.warn("[LearnAI RateLimit] Redis error during limit check, using in-memory:", err);
    }
  }

  return checkMemoryRateLimit(identifier);
}
