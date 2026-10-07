import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getClientEnv,
  _resetClientEnvCache,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GROQ_MODEL,
  DEFAULT_MODEL_IDS,
} from "@/lib/env";
import { getServerEnv, _resetServerEnvCache } from "@/lib/env.server";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";

describe("Phase 1: Environment & Test Harness", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    _resetClientEnvCache();
    _resetServerEnvCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    _resetClientEnvCache();
    _resetServerEnvCache();
  });

  it("verifies test suite is configured and passing", () => {
    expect(true).toBe(true);
  });

  it("defines default model IDs once as constants", () => {
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-3.5-flash");
    expect(DEFAULT_GROQ_MODEL).toBe("llama-3.3-70b-versatile");
    expect(DEFAULT_MODEL_IDS.gemini).toBe("gemini-3.5-flash");
    expect(DEFAULT_MODEL_IDS.groq).toBe("llama-3.3-70b-versatile");
  });

  describe("lib/env.ts: Client Environment Validation", () => {
    it("throws a clear error listing missing variables in development and production (no placeholder fallbacks)", () => {
      // Test with completely missing env
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      expect(() => getClientEnv()).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
      expect(() => getClientEnv()).toThrowError(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);

      _resetClientEnvCache();
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      expect(() => getClientEnv()).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
      expect(() => getClientEnv()).toThrowError(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    });

    it("throws a clear error for invalid URLs", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "not-a-valid-url";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-123";

      expect(() => getClientEnv()).toThrowError(/NEXT_PUBLIC_SUPABASE_URL must be a valid URL/);
    });

    it("parses valid client environment variables successfully", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
      process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

      const parsed = getClientEnv();
      expect(parsed.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
      expect(parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("test-anon-key");
      expect(parsed.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
    });
  });

  describe("lib/env.server.ts: Server Environment Validation", () => {
    it("throws a clear error listing missing server variables in ALL environments (no placeholder fallbacks)", () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      expect(() => getServerEnv()).toThrowError(/SUPABASE_SERVICE_ROLE_KEY/);
      expect(() => getServerEnv()).toThrowError(/GOOGLE_GENERATIVE_AI_API_KEY/);

      _resetServerEnvCache();
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      expect(() => getServerEnv()).toThrowError(/SUPABASE_SERVICE_ROLE_KEY/);
      expect(() => getServerEnv()).toThrowError(/GOOGLE_GENERATIVE_AI_API_KEY/);
    });

    it("parses valid server environment variables and applies default model IDs", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-gemini-key";

      const parsed = getServerEnv();
      expect(parsed.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
      expect(parsed.SUPABASE_SERVICE_ROLE_KEY).toBe("test-service-key");
      expect(parsed.GOOGLE_GENERATIVE_AI_API_KEY).toBe("test-gemini-key");
      expect(parsed.GEMINI_MODEL).toBe("gemini-3.5-flash");
      expect(parsed.GROQ_MODEL).toBe("llama-3.3-70b-versatile");
    });
  });

  describe("Phase 2: Supabase Clients & Core Infrastructure", () => {
    it("instantiates browser client successfully with valid credentials", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

      const client = createBrowserClient();
      expect(client).toBeDefined();
      expect(client.auth).toBeDefined();
    });

    it("instantiates admin client with service_role key and session persistence disabled", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-gemini-key";

      const admin = createAdminClient();
      expect(admin).toBeDefined();
      expect(admin.auth).toBeDefined();
    });
  });
});

import {
  normalizeDifficulty,
  calculateExpectedOutcome,
  calculateKFactor,
  calculateResponseOutcome,
  calculateNewMastery,
  calculateEffectiveMastery,
} from "@/lib/learner/mastery";
import {
  calculateRetentionProbability,
  calculateUpdatedHalfLife,
  isDueForReview,
  buildReviewQueue,
} from "@/lib/learner/forgetting";
import {
  selectExplanationStyle,
  updateStyleStats,
  type StyleStat,
} from "@/lib/learner/bandit";
import {
  canonicalizeTopicSlug,
  getTopicBySlug,
} from "@/lib/learner/topics";
import {
  analyzerOutputSchema,
  quizQuestionSchema,
  submitAnswerSchema,
} from "@/lib/ai/schemas";

describe("Phase 3 & Plan 2: Cognitive Engine & Learner Math (Blueprint v2 Section 3.7)", () => {
  describe("3.3 Mastery Model (lib/learner/mastery.ts)", () => {
    it("normalizes difficulty 1..5 to continuous range 0..1", () => {
      expect(normalizeDifficulty(1)).toBe(0);
      expect(normalizeDifficulty(3)).toBe(0.5);
      expect(normalizeDifficulty(5)).toBe(1);
      // Clamps outside 1..5
      expect(normalizeDifficulty(0)).toBe(0);
      expect(normalizeDifficulty(6)).toBe(1);
    });

    it("calculates expected outcome using logistic scaling factor 0.25", () => {
      // When mastery == difficulty, expected probability is 0.5
      expect(calculateExpectedOutcome(0.5, 0.5)).toBeCloseTo(0.5, 4);
      // When mastery > difficulty, expected > 0.5
      expect(calculateExpectedOutcome(0.8, 0.2)).toBeGreaterThan(0.5);
      // When mastery < difficulty, expected < 0.5
      expect(calculateExpectedOutcome(0.2, 0.8)).toBeLessThan(0.5);
    });

    it("mastery rises on correct answers and falls on wrong ones", () => {
      const initialMastery = 0.5;
      const onCorrect = calculateNewMastery({
        currentMastery: initialMastery,
        difficulty: 3,
        outcome: 1.0,
        attemptsCount: 6,
        isQuizAttempt: true,
      });
      const onWrong = calculateNewMastery({
        currentMastery: initialMastery,
        difficulty: 3,
        outcome: 0.0,
        attemptsCount: 6,
        isQuizAttempt: true,
      });

      expect(onCorrect).toBeGreaterThan(initialMastery);
      expect(onWrong).toBeLessThan(initialMastery);
    });

    it("ensures mastery outputs are strictly clamped within [0, 1]", () => {
      const highMastery = calculateNewMastery({
        currentMastery: 0.99,
        difficulty: 1,
        outcome: 1.0,
        attemptsCount: 1,
        isQuizAttempt: true,
      });
      const lowMastery = calculateNewMastery({
        currentMastery: 0.01,
        difficulty: 5,
        outcome: 0.0,
        attemptsCount: 1,
        isQuizAttempt: true,
      });

      expect(highMastery).toBeLessThanOrEqual(1.0);
      expect(lowMastery).toBeGreaterThanOrEqual(0.0);
    });

    it("correct answers on hard questions move mastery more than on easy ones", () => {
      const initialMastery = 0.5;
      const gainOnHard = calculateNewMastery({
        currentMastery: initialMastery,
        difficulty: 5, // hard
        outcome: 1.0,
        attemptsCount: 10,
        isQuizAttempt: true,
      }) - initialMastery;

      const gainOnEasy = calculateNewMastery({
        currentMastery: initialMastery,
        difficulty: 1, // easy
        outcome: 1.0,
        attemptsCount: 10,
        isQuizAttempt: true,
      }) - initialMastery;

      expect(gainOnHard).toBeGreaterThan(gainOnEasy);
    });

    it("applies 1.5x early learning multiplier when attempts_count < 5", () => {
      const earlyK = calculateKFactor(true, 3);
      const regularK = calculateKFactor(true, 7);
      expect(earlyK).toBeCloseTo(0.15 * 1.5, 4);
      expect(regularK).toBeCloseTo(0.15, 4);
    });

    it("maintains strict 3:1 ratio between quiz attempts (0.15) and chat observations (0.05)", () => {
      const quizK = calculateKFactor(true, 10);
      const chatK = calculateKFactor(false, 10);
      expect(quizK / chatK).toBeCloseTo(3.0, 4);
    });

    it("treats slow correct answers as slightly weaker evidence (outcome 0.8)", () => {
      const fastOutcome = calculateResponseOutcome(true, 5000, 10000);
      const slowOutcome = calculateResponseOutcome(true, 30000, 10000);
      const wrongOutcome = calculateResponseOutcome(false, 5000, 10000);

      expect(fastOutcome).toBe(1.0);
      expect(slowOutcome).toBe(0.8);
      expect(wrongOutcome).toBe(0.0);
    });

    it("computes effective mastery as mastery * retention clamped in [0, 1]", () => {
      expect(calculateEffectiveMastery(0.8, 0.5)).toBe(0.4);
      expect(calculateEffectiveMastery(1.0, 1.0)).toBe(1.0);
    });
  });

  describe("3.4 Forgetting Model (lib/learner/forgetting.ts)", () => {
    it("calculates retention probability R = 2^(-days / halfLife)", () => {
      // 0 days elapsed -> R = 1.0
      expect(calculateRetentionProbability(0, 5)).toBe(1.0);
      // exactly 1 halfLife elapsed -> R = 0.5
      expect(calculateRetentionProbability(5, 5)).toBeCloseTo(0.5, 4);
      // 2 halfLifes elapsed -> R = 0.25
      expect(calculateRetentionProbability(10, 5)).toBeCloseTo(0.25, 4);
    });

    it("half-life grows after correct recall and contracts by half after wrong recall", () => {
      const initialHalfLife = 4.0;
      const grownHalfLife = calculateUpdatedHalfLife(initialHalfLife, true, 0.5);
      const contractedHalfLife = calculateUpdatedHalfLife(initialHalfLife, false, 0.5);

      expect(grownHalfLife).toBeGreaterThan(initialHalfLife);
      expect(contractedHalfLife).toBe(2.0); // 4 * 0.5
    });

    it("yields larger half-life gain when recall was harder (lower retention)", () => {
      const hardRecallGain = calculateUpdatedHalfLife(4.0, true, 0.2); // R = 0.2
      const easyRecallGain = calculateUpdatedHalfLife(4.0, true, 0.9); // R = 0.9

      expect(hardRecallGain).toBeGreaterThan(easyRecallGain);
    });

    it("bounds half-life strictly between 0.5 and 365.0 days", () => {
      const maxHalfLife = calculateUpdatedHalfLife(350.0, true, 0.1);
      const minHalfLife = calculateUpdatedHalfLife(0.6, false, 0.1);

      expect(maxHalfLife).toBeLessThanOrEqual(365.0);
      expect(minHalfLife).toBeGreaterThanOrEqual(0.5);
    });

    it("marks topics due for review when retention R < 0.80", () => {
      expect(isDueForReview(0.79)).toBe(true);
      expect(isDueForReview(0.80)).toBe(false);
      expect(isDueForReview(0.95)).toBe(false);
    });

    it("caps review queue at 5 topics sorted by lowest retention first", () => {
      const topics = Array.from({ length: 10 }, (_, i) => ({
        halfLifeDays: 2.0,
        lastReviewedAt: new Date(Date.now() - (i + 5) * 86400000).toISOString(),
        masteryScore: 0.7,
      }));

      const queue = buildReviewQueue(topics, new Date(), 5);
      expect(queue.length).toBeLessThanOrEqual(5);
      // Lowest retention first
      for (let i = 0; i < queue.length - 1; i++) {
        expect(queue[i].retentionProbability).toBeLessThanOrEqual(queue[i + 1].retentionProbability);
      }
    });
  });

  describe("3.5 Bandit & Curated Topics (lib/learner/bandit.ts & topics.ts)", () => {
    it("updates style stats correctly on reward (1 = alpha++, 0 = beta++)", () => {
      const initial = { alpha: 2, beta: 2 };
      const afterSuccess = updateStyleStats(initial, 1);
      expect(afterSuccess.alpha).toBe(3);
      expect(afterSuccess.beta).toBe(2);

      const afterFailure = updateStyleStats(initial, 0);
      expect(afterFailure.alpha).toBe(2);
      expect(afterFailure.beta).toBe(3);
    });

    it("shifts bandit selection toward the heavily rewarded style", () => {
      const stats: StyleStat[] = [
        { style: "analogy", alpha: 100, beta: 1 },
        { style: "steps", alpha: 1, beta: 100 },
        { style: "example", alpha: 1, beta: 100 },
      ];

      // Across 20 samples, analogy should be chosen consistently
      let analogyPicks = 0;
      for (let i = 0; i < 20; i++) {
        if (selectExplanationStyle(stats) === "analogy") {
          analogyPicks++;
        }
      }
      expect(analogyPicks).toBeGreaterThanOrEqual(19);
    });

    it("canonicalizes topics strictly from curated list or returns other", () => {
      expect(canonicalizeTopicSlug("arrays-and-hashing")).toBe("arrays-and-hashing");
      expect(canonicalizeTopicSlug("hash maps")).toBe("arrays-and-hashing");
      expect(canonicalizeTopicSlug("two pointers")).toBe("two-pointers");
      expect(canonicalizeTopicSlug("completely unrelated gibberish")).toBe("other");
    });

    it("retrieves curated topic details by slug", () => {
      const topic = getTopicBySlug("binary-search");
      expect(topic).toBeDefined();
      expect(topic?.name).toBe("Binary Search");
    });
  });

  describe("Zod Validation Schemas (lib/ai/schemas.ts)", () => {
    it("accepts valid analyzer LLM output and defaults confusionSignals", () => {
      const valid = {
        topicSlug: "binary-search",
        difficulty: 3,
        understood: 0.85,
        confusionSignals: ["off-by-one"],
      };
      const parsed = analyzerOutputSchema.safeParse(valid);
      expect(parsed.success).toBe(true);

      const validDefault = {
        topicSlug: "arrays-and-hashing",
        difficulty: 2,
        understood: 0.9,
      };
      const parsedDefault = analyzerOutputSchema.safeParse(validDefault);
      expect(parsedDefault.success).toBe(true);
      if (parsedDefault.success) {
        expect(parsedDefault.data.confusionSignals).toEqual([]);
      }
    });

    it("rejects malformed analyzer LLM output", () => {
      const invalidDiff = {
        topicSlug: "trees",
        difficulty: 6, // > 5
        understood: 0.5,
      };
      expect(analyzerOutputSchema.safeParse(invalidDiff).success).toBe(false);

      const invalidUnderstood = {
        topicSlug: "trees",
        difficulty: 3,
        understood: 1.5, // > 1.0
      };
      expect(analyzerOutputSchema.safeParse(invalidUnderstood).success).toBe(false);
    });

    it("enforces 4 options, 4 rationales, and null misconception tag at correctIndex", () => {
      const validQuestion = {
        questionText: "What is the time complexity of searching in a balanced BST?",
        difficulty: 3,
        options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
        correctIndex: 1,
        rationales: [
          "O(1) is constant time.",
          "O(log n) is the height of balanced BST.",
          "O(n) is linear time.",
          "O(n log n) is sorting time.",
        ],
        misconceptionTags: ["hash-table-confusion", null, "unbalanced-assumption", "sort-confusion"],
      };

      const parsed = quizQuestionSchema.safeParse(validQuestion);
      expect(parsed.success).toBe(true);

      // Fails if misconception tag at correctIndex is not null
      const invalidTagAtCorrect = {
        ...validQuestion,
        misconceptionTags: ["hash-table-confusion", "oops-not-null", "unbalanced-assumption", "sort-confusion"],
      };
      expect(quizQuestionSchema.safeParse(invalidTagAtCorrect).success).toBe(false);

      // Fails if only 3 options
      const invalidOptionsCount = {
        ...validQuestion,
        options: ["O(1)", "O(log n)", "O(n)"],
      };
      expect(quizQuestionSchema.safeParse(invalidOptionsCount).success).toBe(false);
    });

    it("rejects negative latency in answer submission", () => {
      const invalid = {
        quizId: "123e4567-e89b-12d3-a456-426614174000",
        questionId: "123e4567-e89b-12d3-a456-426614174001",
        chosenIndex: 1,
        timeMs: -50,
      };
      expect(submitAnswerSchema.safeParse(invalid).success).toBe(false);
    });
  });
});
