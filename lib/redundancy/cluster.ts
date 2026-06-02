/**
 * lib/redundancy/cluster.ts
 *
 * Cosine-similarity clustering of embedded claims.
 * Single-link agglomerative: two claims are in the same cluster if any pair
 * has cosine ≥ SIMILARITY_THRESHOLD.  Pure computation — no external calls.
 */

import type { AtomicClaim, ClaimWithEmbedding, ClusterGroup } from "./types";

/**
 * Primary threshold — named constant, tunable.
 *
 * CALIBRATION (text-embedding-3-small, probed on real Ecolab restatement pairs):
 *   true paraphrases scored 0.589 / 0.755 / 0.853 cosine
 *   unrelated claims scored 0.346
 * The original 0.85 missed 2 of 3 true restatements (SRI read ~0.02 on a memo
 * with known heavy repetition). 0.70 catches close paraphrases while staying
 * well clear of the unrelated-claim range. Loose rewordings (~0.59) still
 * escape — lowering toward 0.55–0.60 is possible but needs a larger probe set
 * to rule out false clusters (same metric, different value).
 */
export const SIMILARITY_THRESHOLD = 0.70;

/** Dot product of two same-length vectors */
function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** L2 norm */
function norm(v: number[]): number {
  return Math.sqrt(dot(v, v));
}

/** Cosine similarity ∈ [-1, 1] */
export function cosineSimilarity(a: number[], b: number[]): number {
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  return dot(a, b) / (na * nb);
}

/**
 * Union-Find (disjoint set) for O(α·n) clustering.
 */
class UnionFind {
  private parent: number[];
  private rank: number[];

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array(n).fill(0);
  }

  find(x: number): number {
    if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }

  union(x: number, y: number): void {
    const px = this.find(x);
    const py = this.find(y);
    if (px === py) return;
    if (this.rank[px] < this.rank[py]) { this.parent[px] = py; }
    else if (this.rank[px] > this.rank[py]) { this.parent[py] = px; }
    else { this.parent[py] = px; this.rank[px]++; }
  }
}

/**
 * Cluster claims by semantic similarity.
 *
 * For n claims the pairwise comparison is O(n²·d) where d=1536.
 * For typical memo claim counts (100–400) this runs in well under 1s.
 */
export function clusterClaims(
  claims: ClaimWithEmbedding[],
  threshold: number = SIMILARITY_THRESHOLD
): ClusterGroup[] {
  const n = claims.length;
  if (n === 0) return [];

  const uf = new UnionFind(n);

  // Compare every pair once
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(claims[i].embedding, claims[j].embedding);
      if (sim >= threshold) {
        uf.union(i, j);
      }
    }
  }

  // Group by root
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }

  const clusters: ClusterGroup[] = [];
  let clusterId = 0;

  for (const [, indices] of Array.from(groups.entries())) {
    const instances: AtomicClaim[] = indices.map((idx) => ({
      text: claims[idx].text,
      chapter: claims[idx].chapter,
      index: claims[idx].index,
    }));

    const chapters = Array.from(new Set(instances.map((c) => c.chapter)));

    // Use the shortest claim as the representative label (tends to be the canonical form)
    const label = instances
      .map((c) => c.text)
      .sort((a, b) => a.length - b.length)[0]
      .slice(0, 120);

    clusters.push({
      clusterId: clusterId++,
      label,
      instances,
      chapters,
      chapterSpread: chapters.length,
      assertionCount: instances.length,
    });
  }

  return clusters;
}
