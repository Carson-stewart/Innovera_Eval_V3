/**
 * lib/redundancy/version.ts
 *
 * Redundancy-analysis version stamp. Bump this ONLY when a change alters the
 * SRI for identical memo content — i.e. the cosine threshold, the clustering
 * logic, or how the claim set is counted. The SRI is only comparable across
 * runs that share the same REDUNDANCY_VERSION.
 *
 * Version boundaries (grounded in the stored per-run `threshold` field and the
 * claim-set reconciliation diagnostic — NOT git history, which was squashed
 * into the single 2026-06-02 "Baseline: full V3 working tree" commit and so
 * cannot date these changes):
 *
 *   "0.85-legacy"         cosine threshold 0.85; under-clustered, SRI reads low.
 *                         (Stored runs with threshold == 0.85.)
 *   "0.70-preclusterdrop" threshold 0.70 but an earlier embedding-failure path
 *                         dropped claims before clustering, so claimCount
 *                         exceeded the clustered set (unaccounted > 0). These
 *                         runs are buggy and excluded from analysis.
 *   "0.70-reconciled"     threshold 0.70 with the claim set fully reconciled
 *                         (every counted claim lands in a cluster). CURRENT.
 *
 * The 2026-06-10 embed.ts hardening (fail-fast + retry instead of a silent `[]`
 * fallback) does NOT change the SRI on healthy runs — on a complete embedding
 * response the produced vectors are identical — so it stays within
 * "0.70-reconciled".
 */
export const REDUNDANCY_VERSION = "0.70-reconciled";
