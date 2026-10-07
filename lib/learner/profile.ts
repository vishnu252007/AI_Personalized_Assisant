/**
 * LearnAI — Profile Context Aggregator (lib/learner/profile.ts)
 * Builds a compact summary string under 150 tokens representing learner level,
 * learning style, weakest topics (min 3 attempts), active misconceptions, and due reviews.
 * Follows Blueprint v2 Section 3.5.
 */

export interface LearnerProfileData {
  level: string; // e.g. "beginner", "intermediate", "advanced"
  preferredSubject?: string;
  bestStyle?: string;
  topics: Array<{
    name: string;
    slug: string;
    masteryScore: number;
    effectiveMastery: number;
    attemptsCount: number;
    retentionProbability: number;
    isDueForReview: boolean;
  }>;
  misconceptions: Record<string, number>; // tag -> count
}

/**
 * Builds a concise string summary under 150 tokens for real-time Socratic prompt injection.
 */
export function buildProfileSummary(data: LearnerProfileData): string {
  const level = data.level || "beginner";
  const style = data.bestStyle || "analogy";

  // Weakest topics: minimum 3 attempts, lowest effective mastery
  const qualifiedTopics = data.topics.filter((t) => t.attemptsCount >= 3);
  qualifiedTopics.sort((a, b) => a.effectiveMastery - b.effectiveMastery);
  const weakest = qualifiedTopics.slice(0, 3).map((t) => `${t.name} (${Math.round(t.effectiveMastery * 100)}%)`);

  // Topics due for review
  const due = data.topics
    .filter((t) => t.isDueForReview)
    .slice(0, 3)
    .map((t) => t.name);

  // Top misconceptions: sort by frequency
  const sortedMisconceptions = Object.entries(data.misconceptions || {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);

  const parts: string[] = [
    `Level: ${level}`,
    `Preferred Style: ${style}`,
  ];

  if (weakest.length > 0) {
    parts.push(`Needs Work: ${weakest.join(", ")}`);
  }
  if (due.length > 0) {
    parts.push(`Due Review: ${due.join(", ")}`);
  }
  if (sortedMisconceptions.length > 0) {
    parts.push(`Known Misconceptions: ${sortedMisconceptions.join(", ")}`);
  }

  return parts.join(" | ");
}
