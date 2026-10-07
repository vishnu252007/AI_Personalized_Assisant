/**
 * LearnAI — Elo Mastery Model (lib/learner/mastery.ts)
 * Evaluates student mastery dynamically against question difficulty.
 * Follows Blueprint v2 Section 3.3.
 */

export interface EloMasteryInput {
  currentMastery: number; // 0.0 to 1.0
  difficulty: number; // 1 to 5
  outcome: number; // 1.0 (correct), 0.0 (wrong), 0.8 (slow correct), or 0.0-1.0 (chat understood score)
  attemptsCount: number;
  isQuizAttempt: boolean; // true = 0.15 weight, false = 0.05 weight (strict 3:1 ratio)
}

/**
 * Normalizes difficulty level 1..5 to continuous range 0..1
 */
export function normalizeDifficulty(difficulty: number): number {
  const clampedDiff = Math.min(5, Math.max(1, difficulty));
  return (clampedDiff - 1) / 4;
}

/**
 * Calculates expected outcome using standard logistic function with scaling factor 0.25.
 * E = 1 / (1 + exp(-(mastery - difficulty) / 0.25))
 */
export function calculateExpectedOutcome(mastery: number, normalizedDifficulty: number): number {
  return 1 / (1 + Math.exp(-(mastery - normalizedDifficulty) / 0.25));
}

/**
 * Calculates dynamic K factor.
 * K_base = 0.15 for verified quiz attempts, 0.05 for chat observations (3:1 ratio).
 * Increases learning rate by 1.5x when attempts_count < 5 to learn faster early.
 */
export function calculateKFactor(isQuizAttempt: boolean, attemptsCount: number): number {
  const K_base = isQuizAttempt ? 0.15 : 0.05;
  return K_base * (attemptsCount < 5 ? 1.5 : 1.0);
}

/**
 * Adjusts outcome score for correct quiz answers based on response latency.
 * A slow correct answer counts as slightly weaker evidence (outcome 0.8 instead of 1.0).
 */
export function calculateResponseOutcome(
  isCorrect: boolean,
  responseTimeMs: number,
  runningAverageLatencyMs?: number
): number {
  if (!isCorrect) return 0.0;
  
  // If running average is provided, compare against 1.5x average, or default 25s threshold
  const threshold = runningAverageLatencyMs && runningAverageLatencyMs > 0
    ? runningAverageLatencyMs * 1.5
    : 25000;

  if (responseTimeMs > threshold) {
    return 0.8;
  }
  return 1.0;
}

/**
 * Updates mastery score given an interaction outcome.
 * Outputs are clamped strictly between 0.0 and 1.0.
 */
export function calculateNewMastery(input: EloMasteryInput): number {
  const { currentMastery, difficulty, outcome, attemptsCount, isQuizAttempt } = input;
  
  const d = normalizeDifficulty(difficulty);
  const expected = calculateExpectedOutcome(currentMastery, d);
  const K = calculateKFactor(isQuizAttempt, attemptsCount);
  
  const mNew = currentMastery + K * (outcome - expected);
  return Math.min(1.0, Math.max(0.0, Number(mNew.toFixed(4))));
}

/**
 * Calculates effective mastery = mastery * retention.
 */
export function calculateEffectiveMastery(mastery: number, retentionProbability: number): number {
  const effective = mastery * retentionProbability;
  return Math.min(1.0, Math.max(0.0, Number(effective.toFixed(4))));
}
