/**
 * lib/framing/prompts/catD.ts
 *
 * Pass 4 — Category D: Rule Compliance checks D1–D17.
 *
 * Checks whether the framing document complies with the Innovera Decision Framing
 * Rules — structural rules that govern how framing documents must be written to
 * support downstream scoring.
 * Status values: "PASS" | "FAIL" | "NA"
 *
 * Special rules:
 * - D15 (Client-Stated Input Non-Flagging Rule) is a meta-check: it detects when
 *   a prior check has incorrectly flagged a client-stated value. It is N/A unless
 *   a prior check has flagged a client-stated input. D15 FAIL alone does NOT trigger
 *   "Revisions Required" — the lone-fail carve-out applies.
 * - D16 (Blocking Question Memo-Resolvability Rule): rewrites must NOT prescribe
 *   methodology — only suggest structural reframing.
 */

import type { FramingSection, PromptPayload } from "../types";

// ---------------------------------------------------------------------------
// Check definitions — all D1–D17
// ---------------------------------------------------------------------------

const CAT_D_CHECKS = `
CHECK DEFINITIONS — Category D: Rule Compliance

Checks in this category produce status "PASS", "FAIL", or "NA" only.

D1 — Framing-First Protocol Compliance
WHAT TO CHECK: Is the framing structured to serve as the first input in an LLM scoring call? Does it contain a self-contained preamble that allows the model to interpret all subsequent memo content against this framing?
FAIL if: The framing has no self-contained preamble summarizing the decision question, typology, constraints, and success/kill criteria in a way that could orient an LLM.
Never N/A.
IMPACT: The framing is sent as the first LLM input in every scoring pass. Without a self-contained preamble, the model cannot correctly orient itself before reading the memo.

D2 — Single Decision Question Rule
WHAT TO CHECK: Does the framing contain exactly one primary decision question? (Blocking questions are not primary questions.)
FAIL if: Two or more primary decision questions are present (each asking a separate "should we do X" or "which of A/B should we choose" question).
Never N/A.
IMPACT: Multiple primary decision questions require separate framing documents. Combined framings produce ambiguous Problem Formulation scores.

D3 — No Predetermined Conclusion
WHAT TO CHECK: Does the framing contain language that predetermines the answer — e.g. "confirm that we should proceed with X", "validate our decision to do X", "prove that X is the right choice"?
FAIL if: The framing is structured as advocacy or confirmation-seeking rather than open inquiry.
Never N/A.
IMPACT: A framing that predetermines the conclusion cannot produce an unbiased memo. The downstream memo will be scored against an open question it was not asked to answer.

D4 — Blocking Questions Resolvability Rule
WHAT TO CHECK: Are blocking questions stated as open analytical questions (beginning with What, How, Which, Whether, Why) rather than as declaratives or confirmations?
FAIL if: One or more blocking questions are stated as declaratives ("We need to know the market size"), confirmations ("Confirm the regulatory position"), or imperatives ("Identify all risks").
N/A if: No blocking questions section is present (absence is a B2 finding).
IMPACT: Declarative blocking questions cannot be answered by a memo analyst — they are directives, not analytical questions.

D5 — Success Criteria Quantification Rule
WHAT TO CHECK: Are success criteria — when present — quantified with a measurable threshold that objectively determines Go vs No-Go?
FAIL if: Success criteria are present but lack a measurable threshold (no metric, no target value).
N/A if: Client-Stated Input Protocol applies — client has explicitly declined to quantify, or the criteria are stated as the client's own qualitative thresholds. Default to N/A when attribution is unclear.
IMPACT: Unquantified success criteria force the analyst to invent thresholds, which will be flagged as low-confidence assumptions in Pillar 6.

D6 — Kill Conditions Quantification Rule
WHAT TO CHECK: Are kill conditions — when present — quantified with a measurable threshold that would objectively trigger a stop decision?
FAIL if: Kill conditions are present but lack a measurable threshold (no metric, no threshold value, no timeframe).
N/A if: Client-Stated Input Protocol applies — client has explicitly stated qualitative kill conditions. Default to N/A when attribution is unclear.
IMPACT: Unquantified kill conditions cannot be used by the memo to formulate actionable go/no-go recommendations.

D7 — Assumption Attribution Rule
WHAT TO CHECK: Do assumptions — when present — carry (Client) or (Platform) origin tags using the literal bracket notation?
FAIL if: Assumptions are present and none carry the literal (Client) or (Platform) tag.
N/A if: Client-Stated Input Protocol applies — all assumptions are self-evidently client-provided (e.g. the framing was authored entirely by the client, or a blanket attribution statement is present).
IMPACT: Untagged assumptions cannot be traced through the Pillar 6 Attribution scoring.

D8 — Risk Classification Completeness Rule
WHAT TO CHECK: Are at least 3 risks present in the framing and do they each carry a Bull/Bear/Bilateral classification?
FAIL if: Fewer than 3 risks are present OR no risk carries a Bull/Bear/Bilateral classification.
N/A if: No risks section is present (absence is a B7 finding).
IMPACT: The Risk Review Gate requires at least 3 classified risks from the framing as anchor points for the AI risk generation step.

D9 — Typology Label Exactness Rule
WHAT TO CHECK: Does the typology field use exactly one of the four canonical labels?
  Canonical labels: "1A External Investment", "1B Internal Initiative", "2A New Market Entry", "2B New Product Launch"
  Abbreviated forms also accepted: "1A", "1B", "2A", "2B"
FAIL if: The typology field uses a paraphrased, abbreviated-in-a-different-form, or invented label (e.g. "External", "Investment Memo", "Type B", "New Market").
Never N/A.
IMPACT: Non-canonical typology labels cannot be matched to the expected chapter list for Pillar 3 scoring.

D10 — Decision Authority Naming Rule
WHAT TO CHECK: Is the decision authority named as a specific role or committee rather than a generic label?
FAIL if: Decision authority is stated as "management", "leadership", "the team", "senior leadership", or any other generic collective label without a specific named role or committee.
N/A if: The decision authority is genuinely unresolved at the framing stage (must be stated explicitly in the framing).
IMPACT: Generic authority labels cannot be used to determine the appropriate depth and tone of recommendations.

D11 — Scope Explicitness Rule
WHAT TO CHECK: Does the scope section explicitly state what is OUT of scope (not just what is in scope)?
FAIL if: The scope section exists but contains no "Out of Scope" clause or equivalent explicit exclusion list.
N/A if: Scope is trivially and unambiguously bounded by the decision question itself (e.g. a single-entity, single-action decision with no plausible scope ambiguity).
IMPACT: A scope that only defines inclusions leaves the analyst unable to determine excluded topics, leading to over-scoped memos.

D12 — Capital Ask Range Rule
WHAT TO CHECK: Is the capital ask stated as a range rather than a single point estimate?
FAIL if: A capital ask is present and stated as a single point figure without a range or sensitivity note.
N/A if: Client-Stated Input Protocol applies — client-stated fixed capital commitments are accepted as-is. If the figure is client-provided, set N/A.
IMPACT: Point estimates for capital asks do not satisfy the Specificity sub-dimension requirement.

D13 — Timeline Decision-Date Specificity Rule
WHAT TO CHECK: Is the decision date stated as an absolute date rather than a relative reference?
FAIL if: Decision date is stated as "next quarter", "in six months", "Q3", or any other relative reference that becomes ambiguous when read at a later date.
N/A if: The framing is being used in a real-time context and the relative date is unambiguous given the context (e.g. the framing itself is dated and "next quarter" is therefore interpretable).
IMPACT: Relative dates become undatable when the framing is consulted after the reference period.

D14 — No Recursive Self-Reference Rule
WHAT TO CHECK: Does the framing document reference itself as a source of evidence or justification (e.g. "as stated in this framing, the market is large", "per this document's analysis")?
FAIL if: The framing contains recursive self-citation treating its own assertions as external evidence.
Never N/A.
IMPACT: Recursive self-reference is not evidence. It creates circular reasoning in the scoring pipeline.

D15 — Client-Stated Input Non-Flagging Rule [SPECIAL CARVE-OUT]
WHAT TO CHECK: This is a META-CHECK. It fires ONLY if a prior check in this run has flagged a value that is clearly client-stated.
FAIL if: A prior check (in categories A, B, C, or earlier in D) has flagged a client-stated figure, target, range, or threshold as a completeness, quantification, or logic failure — in violation of the Client-Stated Input Protocol.
N/A if: No prior check in this run has flagged a client-stated input. This is the default.
LONE-FAIL CARVE-OUT: D15 FAIL alone does NOT trigger "Revisions Required". The verdict computation excludes D15 from the lone-fail count.
IMPACT: Overzealous flagging of client-stated inputs undermines client trust and produces spurious revision requests.

D16 — Blocking Question Memo-Resolvability Rule
WHAT TO CHECK: Are blocking questions stated in a form that is resolvable through memo analysis?
FAIL if: One or more blocking questions require a board decision, a client-privileged disclosure, or field investigation that a memo author cannot perform.
N/A if: No blocking questions section is present (absence is a B2 finding).
REWRITE CONSTRAINT: Rewrites for D16 must NOT prescribe what the analysis should conclude or what methodology should be used. Rewrites must only suggest structural reframing — moving the question to "Pre-conditions" or "Open Issues" as appropriate.
IMPACT: Blocking questions that cannot be answered by the memo author will systematically suppress the Gap-filling sub-score regardless of memo quality.

D17 — Version Control Compliance Rule
WHAT TO CHECK: If this framing document has been previously scored (has a prior scoring run associated with it), has the version number been incremented since the last scoring run?
FAIL if: The framing has been updated since its last scoring run AND the version number has not been incremented (silent modification of a versioned document).
N/A if: This is the first-time submission with no prior scoring run.
N/A if: The framing was generated by the Innovera Wizard (auto-versioned by the platform).
IMPACT: Silent modification of a previously-scored framing breaks the rubric traceability chain — memos scored against v1 cannot be compared to those scored against a silently-modified v1.
`.trim();

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildCatDPrompt(
  framingText: string,
  sections: FramingSection[],
  typology: "1A" | "1B" | "2A" | "2B" | null,
): PromptPayload {
  const sectionsJson = JSON.stringify(sections, null, 2);
  const typologyStr = typology ?? "null — typology was not detected in Pass 0";

  const systemPrompt = `You are an Innovera Eval V3 Decision Framing Checker running Pass 4: Category D Rule Compliance checks.

${CAT_D_CHECKS}

EVALUATOR ID: "primary"

SPECIAL RULES — read these before running any checks:

1. D15 LONE-FAIL CARVE-OUT:
   D15 is a meta-check that detects overzealous flagging of client-stated inputs by prior checks.
   - Default to N/A unless you can identify a specific prior check finding that flagged a client-stated value.
   - If D15 FAILS, note the specific prior check that triggered it in the "issue" field.
   - D15 FAIL alone does NOT trigger "Revisions Required" — the server-side verdict computation will apply the lone-fail carve-out.

2. D16 REWRITE CONSTRAINT:
   Rewrites for D16 must ONLY suggest structural reframing (move to "Pre-conditions", move to "Open Issues").
   Rewrites must NEVER prescribe what the analysis should conclude, what methodology should be used, or what the answer to the question should be.

3. CLIENT-STATED INPUT PROTOCOL (applies to D5, D6, D7, D12):
   When the N/A condition references "Client-Stated Input Protocol", default to N/A when attribution is ambiguous.
   Only FAIL when you can confirm the figure/criterion is Platform-originated (explicitly attributed to Innovera analysis) and still unquantified.

ARCHITECTURAL RULES:
1. Valid statuses: "PASS", "FAIL", "NA" only. Never "ADVISORY".
2. confidence: float 0–1.
3. location: quote the specific text from the framing for FAIL findings. For absence issues, set null.
4. issue and impact: null when status is PASS or NA.
5. rewrite: null when PASS or NA. When FAIL, provide structural guidance that does NOT prescribe analytical methodology, specific values, or analytical conclusions.
   SELF-VALIDATION (Pattern 8 guard): Before finalizing each rewrite, verify it does not introduce a new violation while fixing the old one. Specifically: a rewrite for D-category checks must not create a new Decision Block defect (D1/D2/D3), a new constraint ambiguity (D4/D5), or a new falsifiability failure (D15). If the candidate rewrite would introduce such a violation, revise it until it is clean.
6. Return ONLY a valid JSON object. No prose, no markdown fences.

RESPONSE SCHEMA:
{
  "category": "D",
  "results": [
    {
      "checkId": string,
      "evaluator": "primary",
      "status": "PASS" | "FAIL" | "NA",
      "confidence": number,
      "location": string | null,
      "issue": string | null,
      "impact": string | null,
      "rewrite": string | null
    }
  ]
}

Emit exactly 17 result objects, one per check D1 through D17, in order.`;

  const userPrompt = `TYPOLOGY (from Pass 0): ${typologyStr}

EXTRACTED SECTIONS (from Pass 0):
${sectionsJson}

FULL FRAMING DOCUMENT:
---
${framingText}
---

Run all Category D checks (D1–D17) and return the JSON result object.`;

  return {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    responseSchema:
      '{ category: "D", results: FramingCheckResult[17] }',
  };
}
