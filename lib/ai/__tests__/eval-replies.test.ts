import { describe, it, expect } from "vitest";
import {
  validateAnswerFirst,
  validateCheckTag,
  validateWordCount,
  validateMarkdown,
  validateNextChips,
  validateNoLeaks,
  GOLDEN_QUESTIONS,
  evaluateReply,
} from "../../../scripts/eval-replies";

describe("Stage 2 Golden Reply Quality Validators", () => {
  const sampleQuestion = GOLDEN_QUESTIONS[0]; // "What is a hash table?" (Theory, novice)

  describe("validateAnswerFirst", () => {
    it("passes when direct answer is present in first two sentences", () => {
      const text =
        "A hash table is a data structure storing key-value pairs with O(1) lookup. It hashes keys to array indices.\n<next>Collisions|Hashing</next>";
      expect(validateAnswerFirst(sampleQuestion, text).passed).toBe(true);
    });

    it("rejects when theory response opens with counter-question", () => {
      const text =
        "Have you ever thought about how phone books organize numbers? Let us think about keys and values.\n<next>Phonebook|Hash</next>";
      const result = validateAnswerFirst(sampleQuestion, text);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("counter-question");
    });

    it("passes friendly acknowledgment for small talk", () => {
      const smallTalkQ = GOLDEN_QUESTIONS.find((q) => q.category === "small_talk")!;
      const text = "Hello! I am doing great and ready to help you learn.\n<next>Algorithms|Trees</next>";
      expect(validateAnswerFirst(smallTalkQ, text).passed).toBe(true);
    });

    it("passes polite redirect for off-topic questions", () => {
      const offTopicQ = GOLDEN_QUESTIONS.find((q) => q.category === "off_topic")!;
      const text =
        "Argentina won the 2022 World Cup. I specialize in teaching computer science—let me know what code concepts you'd like to explore!\n<next>Graphs|Sorting</next>";
      expect(validateAnswerFirst(offTopicQ, text).passed).toBe(true);
    });
  });

  describe("validateCheckTag", () => {
    it("passes when at most one check tag is present on concept explanation", () => {
      const text =
        "A hash table maps keys to values.\n<check>What is a hash collision?</check>\n<next>Chaining|Probing</next>";
      expect(validateCheckTag(sampleQuestion, text).passed).toBe(true);
    });

    it("fails when more than one check tag is present", () => {
      const text =
        "A hash table maps keys.\n<check>First question?</check>\n<check>Second question?</check>\n<next>A|B</next>";
      expect(validateCheckTag(sampleQuestion, text).passed).toBe(false);
    });

    it("strictly forbids check tag on simple facts and small talk", () => {
      const factQ = GOLDEN_QUESTIONS.find((q) => q.category === "simple_fact")!;
      const textWithCheck =
        "HTTPS uses port 443 by default.\n<check>Do you know what HTTP uses?</check>\n<next>TLS|Certificates</next>";
      const result = validateCheckTag(factQ, textWithCheck);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("forbidden");
    });
  });

  describe("validateWordCount", () => {
    it("passes when word count is within stage limit", () => {
      const text = "A hash table is fast. It uses hashes to store data in buckets.\n<next>A|B</next>";
      expect(validateWordCount(sampleQuestion, text).passed).toBe(true);
    });

    it("excludes code blocks from word count calculation", () => {
      const codeHeavy =
        "Here is how hash tables work in memory.\n```python\n" +
        "line = 1\n".repeat(100) +
        "```\n<next>Next|Topic</next>";
      expect(validateWordCount(sampleQuestion, codeHeavy).passed).toBe(true);
    });

    it("fails when word count exceeds stage threshold", () => {
      const longText = ("word " .repeat(300)) + "\n<next>A|B</next>";
      expect(validateWordCount(sampleQuestion, longText).passed).toBe(false);
    });
  });

  describe("validateMarkdown", () => {
    it("passes when code blocks are properly fenced with language tags", () => {
      const text = "Here is the code:\n```typescript\nconst x = 10;\n```\n<next>A|B</next>";
      expect(validateMarkdown(text).passed).toBe(true);
    });

    it("fails when code fences are unbalanced", () => {
      const text = "Here is unclosed code:\n```typescript\nconst x = 10;\n<next>A|B</next>";
      expect(validateMarkdown(text).passed).toBe(false);
    });

    it("fails when code block is missing explicit language tag", () => {
      const text = "Here is untagged code:\n```\nconst x = 10;\n```\n<next>A|B</next>";
      expect(validateMarkdown(text).passed).toBe(false);
    });
  });

  describe("validateNextChips", () => {
    it("passes with 1 to 3 pipe-separated suggestions", () => {
      const text = "Valid reply.\n<next>Opt 1|Opt 2|Opt 3</next>";
      expect(validateNextChips(text).passed).toBe(true);
    });

    it("fails when missing next tag", () => {
      const text = "Reply without suggestions.";
      expect(validateNextChips(text).passed).toBe(false);
    });

    it("fails when more than 3 options are provided", () => {
      const text = "Reply.\n<next>A|B|C|D|E</next>";
      expect(validateNextChips(text).passed).toBe(false);
    });
  });

  describe("validateNoLeaks", () => {
    it("passes when no prompt internals are leaked", () => {
      const text = "Normal helpful educational tutor response.\n<next>A|B</next>";
      expect(validateNoLeaks(text).passed).toBe(true);
    });

    it("fails when prompt internals or student tags leak", () => {
      const leaky = "According to my system prompt and <student_data>, you are novice.\n<next>A|B</next>";
      expect(validateNoLeaks(leaky).passed).toBe(false);
    });
  });

  describe("Full Golden Suite Evaluation", () => {
    it("achieves 100% pass rate on all 25 curated reference responses", () => {
      for (const q of GOLDEN_QUESTIONS) {
        const evalResult = evaluateReply(q, q.referenceReply);
        if (!evalResult.overallPass) {
          console.error(`Question #${q.id} failed rule:`, evalResult.rules);
        }
        expect(evalResult.overallPass).toBe(true);
      }
    });
  });
});
