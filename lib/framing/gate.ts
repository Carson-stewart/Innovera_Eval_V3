/**
 * lib/framing/gate.ts — T3 gate verdict (pure, unit-testable).
 *
 * The gate verdict is SEPARATE from the existing READY_FOR_* SanityVerdict —
 * it is the scoring-flow-facing summary:
 *   BLOCKED             any Critical finding
 *   PASS_WITH_WARNINGS  Structural findings or anchor-repetition warnings
 *   PASS                otherwise
 */

import { CHECKS_BY_ID } from "./checks";
import type { GateMode } from "./version";

export type GateVerdict = "BLOCKED" | "PASS_WITH_WARNINGS" | "PASS";

/**
 * @param failedCheckIds check IDs with status FAIL (ADVISORY/NA/PASS excluded)
 * @param anchorRepetitionWarnings number of anchors stated more than once
 */
export function computeGateVerdict(
  failedCheckIds: string[],
  anchorRepetitionWarnings: number
): GateVerdict {
  const severities = failedCheckIds.map((id) => CHECKS_BY_ID[id]?.severity ?? "Structural");
  if (severities.includes("Critical")) return "BLOCKED";
  if (severities.includes("Structural") || anchorRepetitionWarnings > 0) {
    return "PASS_WITH_WARNINGS";
  }
  return "PASS";
}

/**
 * Scoring-submission gate. In advisory mode everything is allowed (the verdict
 * is display-only). In enforced mode, BLOCKED and not-run (null) framings stop
 * the submission.
 */
export function gateAllowsScoring(
  mode: GateMode,
  verdict: GateVerdict | null
): { allowed: boolean; reason: string } {
  if (mode === "advisory") {
    return { allowed: true, reason: "advisory mode — gate verdict is informational" };
  }
  if (verdict === null) {
    return {
      allowed: false,
      reason:
        "Framing gate is enforced and this framing has no sanity-check result. Run the sanity checker before scoring.",
    };
  }
  if (verdict === "BLOCKED") {
    return {
      allowed: false,
      reason:
        "Framing gate: BLOCKED — the sanity checker found Critical finding(s). Resolve them (one quantity, one value) before scoring.",
    };
  }
  return { allowed: true, reason: `gate verdict ${verdict}` };
}
