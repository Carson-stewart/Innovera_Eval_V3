/**
 * lib/redundancy/types.ts
 *
 * Shared types for the Phase R1 Redundancy (Five Favorite Friends) diagnostic.
 * Informational ONLY — never affects scores, Memo Confidence, or status badge.
 */

export interface AtomicClaim {
  /** The claim text as extracted from the memo */
  text: string;
  /** Which chapter this instance came from */
  chapter: string;
  /** Original index across all extracted claims */
  index: number;
}

export interface ClaimWithEmbedding extends AtomicClaim {
  /** 1536-dim embedding from text-embedding-3-small */
  embedding: number[];
}

export interface ClusterGroup {
  /** Unique sequential cluster ID */
  clusterId: number;
  /** Short paraphrase label (derived from the first/representative claim) */
  label: string;
  /** All claim instances in this cluster */
  instances: AtomicClaim[];
  /** Distinct chapters this claim appears in */
  chapters: string[];
  /** chapter spread = unique chapter count */
  chapterSpread: number;
  /** total re-assertion count = instances.length */
  assertionCount: number;
}

export interface FavoriteFriend {
  rank: number;
  label: string;
  assertionCount: number;
  chapterSpread: number;
  chapters: string[];
  instances: Array<{ chapter: string; text: string }>;
}

export interface RedundancyMetrics {
  sri: number;              // Self-Repetition Index 0–1
  claimCount: number;       // total extracted claims
  uniqueClusterCount: number;
  threshold: number;        // cosine threshold used
  favoriteFriends: FavoriteFriend[];
  perChapterGain: Record<string, number>; // chapter → fraction of NEW claims (0–1)
}
