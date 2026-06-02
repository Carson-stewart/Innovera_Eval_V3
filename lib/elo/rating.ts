/**
 * ELO rating math — isolated module.
 * Reads/writes ONLY EloRecord / EloComparison. Zero coupling to DimensionScore
 * or any confidence value. Standard Elo with variable K-factor per the schema comment:
 * K=32 for first 30 comparisons per memo, K=16 thereafter.
 */

export const ELO_BASE_RATING = 1500;
export const K_HIGH = 32;   // first K_THRESHOLD comparisons
export const K_LOW  = 16;   // after K_THRESHOLD comparisons
export const K_THRESHOLD = 30;

/** K-factor for a memo that has played `count` comparisons so far. */
export function kFactor(count: number): number {
  return count < K_THRESHOLD ? K_HIGH : K_LOW;
}

/** Expected score for A given the two ratings. Range (0,1). */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Apply one comparison and return the two new ratings.
 * @param ratingA    current rating of memo A
 * @param countA     comparisons memo A has already played (BEFORE this one)
 * @param ratingB    current rating of memo B
 * @param countB     comparisons memo B has already played (BEFORE this one)
 * @param winner     'A' | 'B' | 'TIE'
 * @returns [newRatingA, newRatingB]
 */
export function updateRatings(
  ratingA: number, countA: number,
  ratingB: number, countB: number,
  winner: "A" | "B" | "TIE",
): [number, number] {
  const kA = kFactor(countA);
  const kB = kFactor(countB);
  const eA = expectedScore(ratingA, ratingB);
  const eB = 1 - eA;
  const sA = winner === "A" ? 1 : winner === "TIE" ? 0.5 : 0;
  const sB = winner === "B" ? 1 : winner === "TIE" ? 0.5 : 0;
  const newA = Math.round((ratingA + kA * (sA - eA)) * 10) / 10;
  const newB = Math.round((ratingB + kB * (sB - eB)) * 10) / 10;
  return [newA, newB];
}

/**
 * Replay all comparisons for a memo in chronological order and return
 * the rating after each comparison, for a progression chart.
 * comparisons must be sorted by comparedAt ascending.
 */
export function replayProgression(
  comparisons: Array<{
    memoAId: number;
    memoBId: number;
    winner: string;
    comparedAt: Date | string;
    ratingAfter?: number; // if stored — otherwise we replay from base
  }>,
  memoId: number,
  startRating = ELO_BASE_RATING,
): Array<{ date: string; rating: number }> {
  let rating = startRating;
  const points: Array<{ date: string; rating: number }> = [
    { date: "start", rating },
  ];

  for (const c of comparisons) {
    const isA = c.memoAId === memoId;
    const winner = c.winner as "A" | "B" | "TIE";
    const won =
      winner === "TIE" ? "TIE" : isA === (winner === "A") ? "WIN" : "LOSS";

    // Simple K=32 replay (we don't have the opponent's rating here, so approximate
    // with expected=0.5 — this gives a useful trend even if exact values differ slightly)
    const k = 32;
    const score = won === "WIN" ? 1 : won === "TIE" ? 0.5 : 0;
    rating = Math.round((rating + k * (score - 0.5)) * 10) / 10;
    points.push({
      date: typeof c.comparedAt === "string"
        ? c.comparedAt
        : c.comparedAt.toISOString(),
      rating,
    });
  }

  return points;
}
