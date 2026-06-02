// Pure math utilities for the scoring engine

export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/**
 * Geometric mean of an array of values.
 * Values <= 0 are floored to 0.01 to handle zeros/negatives safely.
 */
export function geometricMean(values: number[]): number {
  if (values.length === 0) return 0;
  const safeValues = values.map((v) => Math.max(v, 0.01));
  const sumOfLogs = safeValues.reduce((acc, v) => acc + Math.log(v), 0);
  return Math.exp(sumOfLogs / safeValues.length);
}

/**
 * Arithmetic mean of an array of values.
 */
export function arithmeticMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

export interface ScoreBand {
  max: number;
  score: number;
}

/**
 * Linear interpolation / band lookup.
 * Finds which band the value falls in and returns the integer score.
 * Bands should be ordered ascending by max.
 * If value exceeds all bands, returns the last band's score.
 */
export function linearInterpolateScore(
  value: number,
  thresholds: ScoreBand[]
): number {
  for (const band of thresholds) {
    if (value <= band.max) return band.score;
  }
  return thresholds[thresholds.length - 1].score;
}

/**
 * Base-minus-penalties formula with optional bonus.
 * Result is clamped to [min, max].
 */
export function baseMinusPenalties(
  base: number,
  penalties: number,
  bonus: number,
  min: number,
  max: number
): number {
  return clamp(base - penalties + bonus, min, max);
}
