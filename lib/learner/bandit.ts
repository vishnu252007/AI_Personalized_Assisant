/**
 * LearnAI — Explanation Bandit via Thompson Sampling (lib/learner/bandit.ts)
 * Selects pedagogical style: "analogy", "steps", or "example".
 * Follows Blueprint v2 Section 3.5.
 */

export const EXPLANATION_STYLES = ["analogy", "steps", "example"] as const;
export type ExplanationStyle = (typeof EXPLANATION_STYLES)[number];

export interface StyleStat {
  style: ExplanationStyle;
  alpha: number;
  beta: number;
}

/**
 * Generates a standard normal random variable using Box-Muller transform.
 */
function sampleStandardNormal(): number {
  let u1 = 0;
  let u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * Samples a Gamma(alpha, 1) distributed variate using Marsaglia and Tsang method.
 */
function sampleGamma(alpha: number): number {
  if (alpha < 1) {
    // Boost alpha with uniform variable
    const u = Math.random();
    return sampleGamma(1 + alpha) * Math.pow(u, 1.0 / alpha);
  }

  const d = alpha - 1.0 / 3.0;
  const c = 1.0 / Math.sqrt(9.0 * d);

  while (true) {
    let z = sampleStandardNormal();
    let v = 1.0 + c * z;
    while (v <= 0) {
      z = sampleStandardNormal();
      v = 1.0 + c * z;
    }

    v = v * v * v;
    const u = Math.random();

    if (u < 1.0 - 0.0331 * z * z * z * z) {
      return d * v;
    }

    if (Math.log(u) < 0.5 * z * z + d * (1.0 - v + Math.log(v))) {
      return d * v;
    }
  }
}

/**
 * Samples from Beta(alpha, beta) using ratio of Gamma variables:
 * X ~ Gamma(alpha, 1), Y ~ Gamma(beta, 1) => X / (X + Y) ~ Beta(alpha, beta)
 */
export function sampleBeta(alpha: number, beta: number): number {
  const safeAlpha = Math.max(0.1, alpha);
  const safeBeta = Math.max(0.1, beta);
  const x = sampleGamma(safeAlpha);
  const y = sampleGamma(safeBeta);
  return x / (x + y);
}

/**
 * Selects the optimal explanation style via Thompson Sampling.
 * Draws from Beta(alpha, beta) for each style and picks the highest.
 */
export function selectExplanationStyle(stats: StyleStat[]): ExplanationStyle {
  if (!stats || stats.length === 0) {
    return "analogy";
  }

  let bestStyle: ExplanationStyle = stats[0].style;
  let maxDraw = -1;

  for (const stat of stats) {
    const draw = sampleBeta(stat.alpha, stat.beta);
    if (draw > maxDraw) {
      maxDraw = draw;
      bestStyle = stat.style;
    }
  }

  return bestStyle;
}

/**
 * Calculates updated alpha and beta values given reward (1 = correct, 0 = incorrect).
 */
export function updateStyleStats(
  current: { alpha: number; beta: number },
  reward: 1 | 0
): { alpha: number; beta: number } {
  return {
    alpha: reward === 1 ? current.alpha + 1.0 : current.alpha,
    beta: reward === 0 ? current.beta + 1.0 : current.beta,
  };
}
