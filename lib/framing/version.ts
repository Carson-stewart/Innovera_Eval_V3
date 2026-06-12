/**
 * lib/framing/version.ts — Sanity Checker version + gate mode.
 *
 * CHECKER_VERSION history:
 *   v1.0  48 checks (A1–A8 advisory, B1–B13, C1–C10, D1–D17), 30 patterns,
 *         READY_FOR_* verdicts.
 *   v1.2  2026-06-11 upgrades: D18 Single Source of Truth (two-stage), P31
 *         "Dual Target" pattern, anchor inventory, gate verdict
 *         (BLOCKED / PASS_WITH_WARNINGS / PASS) surfaced in the scoring flow.
 */
export const CHECKER_VERSION = "v1.2";

/**
 * Gate mode for the scoring flow.
 *  - "advisory": the gate verdict is computed, persisted, and displayed — never blocks.
 *  - "enforced": BLOCKED or not-run framings stop the scoring submission.
 *
 * Shipped as ADVISORY. Flip to "enforced" only after the new checks' false-positive
 * rate is measured on live runs (post-limit queue).
 */
export type GateMode = "advisory" | "enforced";
export const GATE_MODE: GateMode = "advisory";
