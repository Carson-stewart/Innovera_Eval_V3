/**
 * lib/scoring/version.ts
 *
 * Rubric version stamp. Bump ONLY when a change alters scores or badges for
 * identical memo content — scoring formulas, penalty schedules, gate rules.
 * Scores and badges are comparable only within the same RUBRIC_VERSION;
 * cross-version comparison must carry the version label (ELO is the
 * cross-version-safe measure).
 *
 * History:
 *   "V3 v1.0"  Launch rubric. Flat −2.0 major-reconciliation penalty for ≥2
 *              failures; not-scored pillars coalesced to worst-case 1 in
 *              readiness; ship gate consulted Stage 1 + readiness only.
 *   "V3 v1.1"  2026-06-11 (Engine Reopen Phase C, checkpoint-approved):
 *              C1 not-scored pillars excluded from readiness via rescaling;
 *              C2 graduated major-reconciliation penalty (cliff preserved);
 *              C3 P1 findings cache (determinism — no score-rule change);
 *              C4 Stage-2 floor in the ship gate (any D ≤ 2.0 caps at
 *              NEEDS_WORK).
 */
export const RUBRIC_VERSION = "V3 v1.1";
