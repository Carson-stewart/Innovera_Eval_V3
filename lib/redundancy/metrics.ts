/**
 * lib/redundancy/metrics.ts
 *
 * Server-side metric computation from clusters.
 * Pure functions — no external calls.
 */

import type { ClusterGroup, FavoriteFriend, RedundancyMetrics } from "./types";
import { SIMILARITY_THRESHOLD } from "./cluster";

// NOTE: the list of repeated clusters is intentionally UNCAPPED. "Five Favorite
// Friends" names the pattern, not a display limit — on real memos the top 5
// account for only ~half the restated instances, so capping made the headline
// summary not add up. Display ergonomics (collapse beyond 8) live in the UI.

/**
 * Compute the Self-Repetition Index and all derived metrics.
 *
 * SRI = 1 − (unique_clusters / total_claim_instances)
 * Range: 0 (every claim stated once) → approaches 1 (massive restatement).
 *
 * A cluster of size 1 is a claim stated once — it contributes 0 to redundancy.
 * A cluster of size k contributes (k−1) redundant assertions.
 *
 * Alternative reading:
 *   redundant_assertions = sum(k - 1) for each cluster of size k
 *   SRI = redundant_assertions / total_claim_instances
 */
export function computeMetrics(
  clusters: ClusterGroup[],
  threshold: number = SIMILARITY_THRESHOLD
): RedundancyMetrics {
  const totalClaims = clusters.reduce((s, c) => s + c.assertionCount, 0);
  const uniqueClusters = clusters.length;

  // SRI = fraction of claims that are restatements (assertion_count - 1 per cluster)
  const redundantAssertions = clusters.reduce(
    (s, c) => s + Math.max(0, c.assertionCount - 1),
    0
  );
  const sri = totalClaims > 0 ? redundantAssertions / totalClaims : 0;

  // ALL repeated clusters by assertion count (tie-break: chapter spread descending)
  const sorted = [...clusters].sort((a, b) => {
    const dc = b.assertionCount - a.assertionCount;
    if (dc !== 0) return dc;
    return b.chapterSpread - a.chapterSpread;
  });

  const favoriteFriends: FavoriteFriend[] = sorted
    .filter((c) => c.assertionCount > 1) // only clusters with actual restatement (singletons excluded)
    .map((c, i) => ({
      rank: i + 1,
      label: c.label,
      assertionCount: c.assertionCount,
      chapterSpread: c.chapterSpread,
      chapters: c.chapters,
      instances: c.instances.map((inst) => ({
        chapter: inst.chapter,
        text: inst.text,
      })),
    }));

  // Per-chapter information gain: for each chapter, what fraction of its claims
  // are NEW (appear for the first time vs earlier chapters)?
  // Chapters are processed in the order they appear in the claim indices.
  const perChapterGain: Record<string, number> = {};

  // Determine chapter order from claim indices
  const chapterOrder: string[] = [];
  const chapterSeen = new Set<string>();
  for (const cluster of clusters) {
    for (const inst of cluster.instances.sort((a, b) => a.index - b.index)) {
      if (!chapterSeen.has(inst.chapter)) {
        chapterSeen.add(inst.chapter);
        chapterOrder.push(inst.chapter);
      }
    }
  }

  // Build a map: chapter → set of cluster IDs it contains
  const chapterClusters = new Map<string, Set<number>>();
  for (const cluster of clusters) {
    for (const inst of cluster.instances) {
      if (!chapterClusters.has(inst.chapter)) {
        chapterClusters.set(inst.chapter, new Set());
      }
      chapterClusters.get(inst.chapter)!.add(cluster.clusterId);
    }
  }

  const seenClusterIds = new Set<number>();
  for (const ch of chapterOrder) {
    const ids = chapterClusters.get(ch) ?? new Set();
    const total = ids.size;
    const newIds = Array.from(ids).filter((id) => !seenClusterIds.has(id)).length;
    perChapterGain[ch] = total > 0 ? newIds / total : 1;
    Array.from(ids).forEach((id) => seenClusterIds.add(id));
  }

  return {
    sri: Math.round(sri * 1000) / 1000, // 3 decimal places
    claimCount: totalClaims,
    uniqueClusterCount: uniqueClusters,
    threshold,
    favoriteFriends,
    perChapterGain,
  };
}
