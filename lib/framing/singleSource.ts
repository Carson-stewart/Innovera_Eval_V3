/**
 * lib/framing/singleSource.ts — D18 Single Source of Truth check orchestration.
 *
 * Two-stage design:
 *   Stage 1 (deterministic, this module + quantities.ts): extract quantities,
 *           emit candidate pairs. Fully unit-testable, zero LLM.
 *   Stage 2 (LLM, run-time only): adjudicate whether a candidate pair refers to
 *           the same quantity-concept. The adjudicator is INJECTED — this module
 *           never imports the OpenRouter client, so no test code path can reach
 *           a real LLM call. The Inngest pipeline supplies the real adjudicator
 *           built on callModelJSON; tests supply mocks.
 */

import { extractCandidatePairs, type CandidatePair } from "./quantities";
import { SINGLE_SOURCE_CHECK } from "./checks";

export interface AdjudicationVerdict {
  sameConcept: boolean;
  reasoning: string;
}

export type Adjudicator = (pair: CandidatePair) => Promise<AdjudicationVerdict>;

export interface ConfirmedConflict {
  pair: CandidatePair;
  reasoning: string;
}

export interface SingleSourceResult {
  checkId: string; // "D18"
  status: "PASS" | "FAIL";
  confidence: number;
  location: string | null;
  issue: string | null;
  impact: string | null;
  rewrite: string | null;
  /** stage-1 candidate count — previews the stage-2 adjudication cost */
  candidateCount: number;
  confirmed: ConfirmedConflict[];
}

/** Stage-2 prompt, exposed for inspection/tests; consumed by the runtime adjudicator. */
export function buildAdjudicationPrompt(pair: CandidatePair): {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
} {
  const system = `You are adjudicating a candidate single-source-of-truth conflict in a decision framing document.

Two quantities of the same unit class were found with differing values. Decide whether they refer to the SAME quantity-concept (the same real-world quantity that should have exactly one authoritative value in this document).

NOT the same concept (answer false): different metrics, different scopes (e.g. global vs regional), different scenarios, different time horizons, one is a component of the other.

Client-Stated Input Protocol note: client-originated figures are NOT exempt here — the protocol shields client figures from plausibility challenges, not from contradicting each other. Two conflicting client-stated values for one concept are exactly what this check exists to catch.

Return ONLY valid JSON: { "sameConcept": true|false, "reasoning": "<one sentence>" }`;

  const user = `QUANTITY A (line ${pair.a.line}): "${pair.a.raw}"
Statement: "${pair.a.statement}"

QUANTITY B (line ${pair.b.line}): "${pair.b.raw}"
Statement: "${pair.b.statement}"

Stage-1 shared signals: ${pair.sharedSignals.join(", ")}

Do these refer to the same quantity-concept? Return the JSON object only.`;

  return { system, messages: [{ role: "user", content: user }] };
}

/**
 * Run the D18 check: stage 1 deterministic, stage 2 via the injected adjudicator.
 */
export async function runSingleSourceCheck(
  framingText: string,
  adjudicate: Adjudicator
): Promise<SingleSourceResult> {
  const candidates = extractCandidatePairs(framingText);

  const confirmed: ConfirmedConflict[] = [];
  for (const pair of candidates) {
    const verdict = await adjudicate(pair);
    if (verdict.sameConcept) {
      confirmed.push({ pair, reasoning: verdict.reasoning });
    }
  }

  if (confirmed.length === 0) {
    return {
      checkId: SINGLE_SOURCE_CHECK.id,
      status: "PASS",
      confidence: 0.9,
      location: null,
      issue: null,
      impact: null,
      rewrite: null,
      candidateCount: candidates.length,
      confirmed,
    };
  }

  const first = confirmed[0];
  const describe = (c: ConfirmedConflict) =>
    `"${c.pair.a.raw}" (line ${c.pair.a.line}) vs "${c.pair.b.raw}" (line ${c.pair.b.line})`;

  return {
    checkId: SINGLE_SOURCE_CHECK.id,
    status: "FAIL",
    confidence: 0.9,
    location: `${first.pair.a.statement} || ${first.pair.b.statement}`,
    issue:
      `Single source of truth violated: ${confirmed.length} unreconciled value pair(s) for the same quantity-concept — ` +
      confirmed.map(describe).join("; ") + ".",
    impact:
      "Each unreconciled pair seeds downstream reconciliation failures: the memo inherits both values and restates the conflict across chapters (corpus record: 15 reconciliation failures from one dual-target framing).",
    rewrite:
      "State each quantity exactly once, marked authoritative; if a second value is genuinely needed, label it explicitly as a scenario, a different time horizon, or a different scope " +
      `(e.g. reconcile ${describe(first)} into one value or one labeled range).`,
    candidateCount: candidates.length,
    confirmed,
  };
}
