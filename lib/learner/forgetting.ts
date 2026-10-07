/**
 * LearnAI — Ebbinghaus Memory & Spaced Repetition (lib/learner/forgetting.ts)
 * Follows Blueprint v2 Section 3.4.
 */

export interface TopicRetentionState {
  topicId: string;
  topicSlug: string;
  topicName: string;
  halfLifeDays: number;
  lastReviewedAt: Date | string;
  masteryScore: number;
}

/**
 * Calculates current retention probability R = 2^(-days_since_last_seen / halfLife)
 */
export function calculateRetentionProbability(
  daysSinceLastSeen: number,
  halfLifeDays: number
): number {
  if (halfLifeDays <= 0) return 0.0;
  if (daysSinceLastSeen <= 0) return 1.0;
  const R = Math.pow(2, -daysSinceLastSeen / halfLifeDays);
  return Math.min(1.0, Math.max(0.0, Number(R.toFixed(4))));
}

/**
 * Calculates updated half-life following recall outcome:
 * - On correct: halfLife = min(365, halfLife * (1.3 + (1 - R))) (larger gain when recall was harder)
 * - On wrong: halfLife = max(0.5, halfLife * 0.5)
 */
export function calculateUpdatedHalfLife(
  currentHalfLifeDays: number,
  isCorrect: boolean,
  currentRetentionR: number
): number {
  if (isCorrect) {
    const growthFactor = 1.3 + (1.0 - currentRetentionR);
    const newHalfLife = currentHalfLifeDays * growthFactor;
    return Math.min(365.0, Math.max(0.5, Number(newHalfLife.toFixed(2))));
  } else {
    const contractedHalfLife = currentHalfLifeDays * 0.5;
    return Math.max(0.5, Math.min(365.0, Number(contractedHalfLife.toFixed(2))));
  }
}

/**
 * Checks whether a topic is due for review (R < 0.80).
 */
export function isDueForReview(retentionProbability: number): boolean {
  return retentionProbability < 0.80;
}

/**
 * Filters and prioritizes topics due for review.
 * The review queue is capped at 5 topics per day, sorted by lowest retention probability first.
 */
export function buildReviewQueue<T extends { halfLifeDays: number; lastReviewedAt: Date | string; masteryScore: number }>(
  topics: T[],
  currentDate: Date = new Date(),
  maxTopics: number = 5
): Array<T & { retentionProbability: number; daysSinceLastSeen: number }> {
  const evaluated = topics.map((t) => {
    const lastSeen = new Date(t.lastReviewedAt);
    const diffMs = Math.max(0, currentDate.getTime() - lastSeen.getTime());
    const daysSince = diffMs / (1000 * 60 * 60 * 24);
    const R = calculateRetentionProbability(daysSince, t.halfLifeDays);
    return {
      ...t,
      retentionProbability: R,
      daysSinceLastSeen: Number(daysSince.toFixed(2)),
    };
  });

  return evaluated
    .filter((t) => isDueForReview(t.retentionProbability))
    .sort((a, b) => a.retentionProbability - b.retentionProbability)
    .slice(0, maxTopics);
}
