import { describe, it, expect } from "vitest";
import {
  deriveConceptStage,
  EVENT_WEIGHTS,
  type ConceptStage,
} from "../engine-v2";
import { calculateRetentionProbability } from "../forgetting";
import { buildSocraticTutorPrompt, type TutorContext } from "@/lib/ai/prompts";

describe("Stage 5: Learner Model v2 & Synthetic Student Simulation", () => {
  describe("1. Fast Learner Simulation", () => {
    it("progresses sequentially from unseen to mastered with sustained positive evidence", () => {
      let stage: ConceptStage = "unseen";
      let mastery = 0.30;
      let evidenceCount = 0;

      // Event 1: First quiz answer (correct)
      evidenceCount++;
      mastery = Math.min(0.98, mastery + EVENT_WEIGHTS.quiz_answer); // 0.45
      stage = deriveConceptStage(mastery, evidenceCount, stage);
      expect(stage).toBe("exploring"); // evidence < 3

      // Event 2 & 3: Concept checks answered correctly
      for (let i = 0; i < 2; i++) {
        evidenceCount++;
        mastery = Math.min(0.98, mastery + EVENT_WEIGHTS.check_answered);
        stage = deriveConceptStage(mastery, evidenceCount, stage);
      }
      expect(evidenceCount).toBe(3);
      expect(mastery).toBeGreaterThanOrEqual(0.40);
      expect(stage).toBe("developing"); // evidence >= 3, mastery >= 0.40

      // Events 4 & 5: More quizzes answered correctly
      for (let i = 0; i < 2; i++) {
        evidenceCount++;
        mastery = Math.min(0.98, mastery + EVENT_WEIGHTS.quiz_answer);
        stage = deriveConceptStage(mastery, evidenceCount, stage);
      }
      expect(evidenceCount).toBe(5);
      expect(mastery).toBeGreaterThanOrEqual(0.70);
      expect(stage).toBe("proficient"); // evidence >= 5, mastery >= 0.70

      // Events 6, 7, 8: Continued perfection
      for (let i = 0; i < 3; i++) {
        evidenceCount++;
        mastery = Math.min(0.98, mastery + EVENT_WEIGHTS.quiz_answer);
        stage = deriveConceptStage(mastery, evidenceCount, stage);
      }
      expect(evidenceCount).toBe(8);
      expect(mastery).toBeGreaterThanOrEqual(0.88);
      expect(stage).toBe("mastered"); // evidence >= 8, mastery >= 0.88
    });
  });

  describe("2. Struggling Learner Simulation", () => {
    it("remains bounded in exploring/developing due to recurring misconceptions despite high evidence count", () => {
      let stage: ConceptStage = "unseen";
      let mastery = 0.25;
      let evidenceCount = 0;

      // 10 events with alternating or failed outcomes
      for (let i = 0; i < 10; i++) {
        evidenceCount++;
        // Frequent failed check or quiz answer
        const isFailure = i % 2 === 0;
        const delta = isFailure
          ? -Math.abs(EVENT_WEIGHTS.quiz_answer * 0.8)
          : EVENT_WEIGHTS.chat_signal;
        mastery = Math.max(0.10, Math.min(0.98, mastery + delta));
        stage = deriveConceptStage(mastery, evidenceCount, stage);
      }

      expect(evidenceCount).toBe(10);
      expect(mastery).toBeLessThan(0.45);
      // Can never reach proficient or mastered because mastery is low
      expect(stage).not.toBe("proficient");
      expect(stage).not.toBe("mastered");
    });
  });

  describe("3. Forgetful Learner Simulation", () => {
    it("experiences retention decay over elapsed days, triggering spaced repetition review", () => {
      const halfLifeDays = 2.0;

      // Day 0: Just reviewed, retention is 100%
      const R_day0 = calculateRetentionProbability(0, halfLifeDays);
      expect(R_day0).toBe(1.0);

      // Day 2 (1 half-life elapsed): Retention drops to 50%
      const R_day2 = calculateRetentionProbability(2.0, halfLifeDays);
      expect(R_day2).toBeCloseTo(0.5, 2);

      // Day 5: Retention severely decayed (< 0.20)
      const R_day5 = calculateRetentionProbability(5.0, halfLifeDays);
      expect(R_day5).toBeLessThan(0.20);
      expect(R_day5 <= 0.70).toBe(true); // Triggers spaced repetition item in daily plan!
    });
  });

  describe("4. TutorContext Differentiation Across Student Stages", () => {
    it("adapts system prompt length, explanations, and scaffolding between novice and mastered", () => {
      const noviceContext: TutorContext = {
        conceptName: "Binary Search",
        stage: "novice",
        misconceptions: ["off-by-one"],
        traits: { preferredDepth: "concise", preferredLength: "short", pace: "slow" },
      };

      const masteredContext: TutorContext = {
        conceptName: "Binary Search",
        stage: "mastered",
        traits: { preferredDepth: "in-depth", preferredLength: "detailed", pace: "fast" },
      };

      const novicePrompt = buildSocraticTutorPrompt("Profile: Computer Science beginner", "analogy", noviceContext);
      const masteredPrompt = buildSocraticTutorPrompt("Profile: Senior engineer", "code_first", masteredContext);

      // Novice prompt has novice level instructions, word limit of 180 words, and flags misconceptions
      expect(novicePrompt).toContain('LEVEL: "novice"');
      expect(novicePrompt).toContain("Max 180 words");
      expect(novicePrompt).toContain("Prior misconceptions: off-by-one");

      // Mastered prompt has mastered level instructions, word limit of 250 words, rigorous depth
      expect(masteredPrompt).toContain('LEVEL: "mastered"');
      expect(masteredPrompt).toContain("Max 250 words");
      expect(masteredPrompt).toContain("rigorous depth");
    });
  });
});
