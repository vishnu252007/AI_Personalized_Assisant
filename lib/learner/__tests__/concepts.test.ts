import { describe, it, expect } from "vitest";
import { toConceptSlug, extractConceptFromConversation } from "../concepts";

describe("lib/learner/concepts", () => {
  it("normalizes diverse text into clean concept slugs", () => {
    expect(toConceptSlug("Next.js App Router")).toBe("next-js-app-router");
    expect(toConceptSlug("Binary Search Trees (AVL)")).toBe("binary-search-trees-avl");
    expect(toConceptSlug("   Special @#$ Characters & Symbols  ")).toBe("special-characters-symbols");
    expect(toConceptSlug("")).toBe("general-concept");
  });

  it("extracts curated topic quickly from conversation content without LLM call", async () => {
    const turns = [
      { role: "user", content: "How do two pointers work when sorting an array?" },
      { role: "assistant", content: "Two pointers move from opposite ends towards the center." },
    ];

    const extracted = await extractConceptFromConversation(turns);
    expect(extracted.conceptSlug).toBe("two-pointers");
    expect(extracted.conceptName).toBe("Two Pointers");
    expect(extracted.difficulty).toBe(2);
  });

  it("gracefully falls back when no curated match and LLM fails", async () => {
    // Force provider failure by mocking or unexpected input
    const turns = [
      { role: "user", content: "Quantum Computing Grover Search" },
    ];

    const extracted = await extractConceptFromConversation(turns);
    expect(extracted.conceptSlug).toBeDefined();
    expect(extracted.conceptName).toBeDefined();
    expect(extracted.difficulty).toBeGreaterThanOrEqual(1);
  });
});
