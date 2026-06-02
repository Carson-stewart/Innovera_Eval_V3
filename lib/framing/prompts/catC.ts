/**
 * lib/framing/prompts/catC.ts
 *
 * Pass 3 — Category C: Structural Integrity checks C1–C10.
 *
 * Checks whether the framing document is correctly structured and internally consistent
 * at the structural level (ordering, placement, naming conventions, cross-references).
 * Status values: "PASS" | "FAIL" | "NA"
 *
 * Special rules:
 * - C10 (Framing–Memo Typology Alignment) is Critical severity — a FAIL here carries
 *   maximum verdict weight. Never set C10 to NA.
 * - Client-Stated Input Protocol applies to C5 (Quantification Convention Consistency)
 *   and C8 (Assumption Source Tagging).
 */

import type { FramingSection, PromptPayload } from "../types";

// ---------------------------------------------------------------------------
// Check definitions — all C1–C10
// ---------------------------------------------------------------------------

const CAT_C_CHECKS = `
CHECK DEFINITIONS — Category C: Structural Integrity

Checks in this category produce status "PASS", "FAIL", or "NA" only.

C1 — Section Order Convention
WHAT TO CHECK: Do the framing sections appear in the canonical order? Canonical order:
  Decision Question → Scope → Typology → Decision Authority → Timeline →
  Objectives / Success Criteria → Kill Conditions → Constraints → Assumptions →
  Risks / Key Risks → Blocking Questions → Stakeholders
FAIL if: A section appears in an order that obscures the logic flow (e.g. Risks before the Decision Question; Constraints after Assumptions).
N/A if: The framing is a single-section document.
IMPACT: Non-standard ordering forces the LLM scoring pipeline to re-sequence context, introducing interpretation errors.

C2 — Decision Question Placement
WHAT TO CHECK: Is the decision question the first substantive element of the framing document (preceded only by a title block, metadata, or preamble)?
FAIL if: The decision question appears after substantive content (sections other than title/metadata/preamble).
Never N/A.
IMPACT: The framing is sent as the first LLM input; the decision question must be immediately available to orient the model.

C3 — Section Header Naming Convention
WHAT TO CHECK: Do section headers use recognized framing section names, or do they use non-standard labels that do not map to canonical names?
FAIL if: One or more section headers use non-standard labels (e.g. "Background" where "Scope" is expected; "Concerns" instead of "Risks"; "Milestones" instead of "Timeline") without a mapping note.
N/A if: The framing uses a client-specified template with documented non-standard names (explicit in the framing or in accompanying metadata).
IMPACT: Non-standard headers prevent automated section extraction in the scoring pipeline.

C4 — Single Document Integrity
WHAT TO CHECK: Does the framing contain unresolved external references (e.g. "see attached", "per the model in Tab 3", "as shown in the appendix") that are required to understand the framing but are not included?
FAIL if: One or more critical external references are unresolved — the framing cannot be understood without the referenced material.
Never N/A.
IMPACT: The framing must be self-contained. External references break the scoring pipeline's ability to evaluate the framing in isolation.

C5 — Quantification Convention Consistency
WHAT TO CHECK: Are numerical values stated consistently across the framing (same units, same currency, same scale)?
FAIL if: Figures use inconsistent units for the same metric (e.g. percentages mixed with ratios; USD mixed with EUR without conversion).
N/A if: All figures are client-stated and presented in the client's own convention — Client-Stated Input Protocol: do not flag client-provided figures for convention inconsistency unless two client-stated figures for the same metric use different units.
IMPACT: Inconsistent quantification conventions force the scoring model to make unit conversion assumptions, introducing error.

C6 — Blocking Question Actionability
WHAT TO CHECK: Are all blocking questions answerable by a memo analyst using information types available to an analyst (public data, management interviews, financial models)?
FAIL if: One or more blocking questions require privileged access the analyst cannot have, are rhetorical, or are unanswerable through analysis.
N/A if: No blocking questions section is present (absence is a B2 finding).
IMPACT: Unanswerable blocking questions cannot be satisfied by the memo, which will artificially suppress the Gap-filling sub-score.

C7 — Risk Taxonomy Labeling
WHAT TO CHECK: Are risks in the framing classified by type (Bull/Bear/Bilateral) and severity?
FAIL if: Risks are listed but carry no Bull/Bear/Bilateral classification and/or no severity rating.
N/A if: No risks section is present (absence is a B7 finding).
IMPACT: Unclassified risks cannot be used by the Risk Review Gate as anchor points.

C8 — Assumption Source Tagging
WHAT TO CHECK: Are assumptions in the framing tagged as (Client) or (Platform) origin?
FAIL if: Assumptions are present but none carry (Client) or (Platform) origin tags.
N/A if: All assumptions are client-stated and the framing explicitly notes this blanket attribution (e.g. "All assumptions in this framing are client-provided").
CLIENT-STATED INPUT PROTOCOL: Do not fail C8 because a client-provided assumption lacks a (Client) tag if context makes the client origin self-evident throughout the document.
IMPACT: Untagged assumptions prevent Pillar 6 Attribution scoring.

C9 — Framing Version and Date Stamp
WHAT TO CHECK: Does the framing document carry a version number and date stamp?
FAIL if: No version number or date stamp is present.
N/A if: The framing was generated via the Innovera Wizard (auto-stamps version and date).
IMPACT: Without a version stamp, it is impossible to determine which version of the framing a scored memo corresponds to, breaking rubric traceability.

C10 — Framing–Memo Typology Alignment [CRITICAL]
WHAT TO CHECK: Is the declared typology (1A/1B/2A/2B) consistent with the decision question and scope?
FAIL if: The declared typology is inconsistent with the decision question — e.g. typology is 1B Internal Initiative but the decision question is about acquiring an external company (should be 1A); or typology is 2A New Market Entry but the framing describes a new product for an existing market (should be 2B).
Never N/A — even if typology is null (null typology = fail B8, but C10 still runs to check internal consistency of any typology-related language in the document).
SEVERITY NOTE: C10 is CRITICAL. A FAIL on C10 carries maximum weight in the final verdict computation. Quote the specific misalignment evidence.
IMPACT: Typology drives the entire expected-chapter structure (Pillar 3). A mismatched typology causes systematic scoring errors across Stage 1.
`.trim();

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildCatCPrompt(
  framingText: string,
  sections: FramingSection[],
  typology: "1A" | "1B" | "2A" | "2B" | null,
): PromptPayload {
  const sectionsJson = JSON.stringify(sections, null, 2);
  const typologyStr = typology ?? "null — typology was not detected in Pass 0";

  const systemPrompt = `You are an Innovera Eval V3 Decision Framing Checker running Pass 3: Category C Structural Integrity checks.

${CAT_C_CHECKS}

EVALUATOR ID: "primary"

CRITICAL CHECK RULE — C10:
C10 is the only Critical-severity check in Category C. If C10 is FAIL, the rewrite must quote the specific typology mismatch evidence verbatim. Never set C10 to NA.

CLIENT-STATED INPUT PROTOCOL (applies to C5 and C8):
Do not flag client-stated figures or client-provided assumptions for convention violations unless two client-stated figures for the same metric directly contradict each other.

ARCHITECTURAL RULES:
1. Valid statuses: "PASS", "FAIL", "NA" only. Never "ADVISORY".
2. confidence: float 0–1.
3. location: quote the specific text from the framing for FAIL findings. For absence issues, set null.
4. issue and impact: null when status is PASS or NA.
5. rewrite: null when PASS or NA. When FAIL, provide structural guidance that does NOT prescribe analytical methodology or specific values.
6. Return ONLY a valid JSON object. No prose, no markdown fences.

RESPONSE SCHEMA:
{
  "category": "C",
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

Emit exactly 10 result objects, one per check C1 through C10, in order.`;

  const userPrompt = `TYPOLOGY (from Pass 0): ${typologyStr}

EXTRACTED SECTIONS (from Pass 0):
${sectionsJson}

FULL FRAMING DOCUMENT:
---
${framingText}
---

Run all Category C checks (C1–C10) and return the JSON result object.`;

  return {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    responseSchema:
      '{ category: "C", results: FramingCheckResult[10] }',
  };
}
