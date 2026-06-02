export interface BenchmarkRow {
  id: number;
  typology: string;
  metric: string;
  plausibleRange: string;
  boundaryRange: string | null;
  outOfRange: string | null;
  sources: string;
}

export interface Tier3P7PromptInput {
  framingContent: string;
  fullMemoContent: string;
  benchmarkRows: BenchmarkRow[];
  typology: string;
}

export interface PromptPayload {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

export function buildTier3P7Prompt(input: Tier3P7PromptInput): PromptPayload {
  const benchmarkTable = input.benchmarkRows
    .map(
      (r) =>
        `- ${r.metric}: Plausible=${r.plausibleRange}${r.boundaryRange ? `, Boundary=${r.boundaryRange}` : ""}${r.outOfRange ? `, OOR=${r.outOfRange}` : ""} (Sources: ${r.sources})`
    )
    .join("\n");

  const system = `You are an expert memo evaluator for the Innovera Eval V3 framework (Rubric V3 v1.0), performing the Pillar 7 — Output Realism evaluation.

Your role is to measure and classify financial claims — NOT to compute final scores. You return raw claim inventories, calibration records, and FIC test results. The server computes ORI from your classifications.

SPARSE DATA PROTOCOL — Apply before anything else:
1. Count all scoreable financial claims (numeric claims with financial significance).
2. Declare the count before any classification.
3. If count = 0: still return the full structure with empty arrays — the server will mark NOT_SCORED.
4. If count 1-2: classify NP and CC only (FIC tests still attempted).
5. If count 3-4: partial protocol — NP, CC, and FIC at 0.5 weight.
6. If count 5+: full protocol — all three components.
Do NOT penalize financial thinness in P7. Zero claims is NOT a P7 failure.

PILLAR 7 AI GUARDRAILS:
- AG-1: Benchmark Library is the EXCLUSIVE NP reference. Claims for metrics NOT in the library → "not-in-library" classification (neutral, not penalized).
- AG-2: No hallucinated figures. A claim absent from the memo = N/A in FIC, not Fail.
- AG-3: Rule-bound claim selection. Count only load-bearing financial claims ("if false, would the recommendation change?").
- AG-4: Mandatory certainty vocabulary: definitive / moderate / hedged.
- AG-5: Weakest-source rule for CC. Use the lowest-quality source cited for that claim.
- AG-6: Declare sparse protocol count before scoring.
- AG-7: Score P7 in isolation.

COMMON AI GUARDRAILS: AG-C1 through AG-C5 apply.

Return ONLY valid JSON. No prose outside the JSON.`;

  const userContent = `=== FRAMING DOCUMENT (read first) ===
${input.framingContent}

=== BENCHMARK LIBRARY FOR TYPOLOGY ${input.typology} ===
${benchmarkTable || "No benchmark entries available for this typology — all claims will be classified as 'not-in-library'."}

=== FULL MEMO TEXT ===
${input.fullMemoContent}

=== TASK ===
Apply the sparse-data protocol and return the Pillar 7 claim inventory as a single JSON object.

─── NP METRIC MATCHING — APPLY BEFORE CLASSIFYING ─────────────────────────────
Step M1 — IDENTIFY the claim's metric from the memo text. Quote the exact phrase.
Step M2 — SELECT the benchmark entry using this priority order:
  a) Use the TYPOLOGY-SPECIFIC entry (e.g., TWO_B) whose category label (SaaS, hardware, services) best matches the FRAMING DOCUMENT's description of the product/service. Quote the framing phrase that determined the category choice.
  b) If no typology-specific entry matches, use a CROSS entry.
  c) If the product is hybrid (e.g., part SaaS, part professional services), use the benchmark matching the DOMINANT revenue type as described in the framing. If dominance is ambiguous, use "not-in-library" — do NOT force-fit an inapplicable metric.
  d) State the selected metric name in the "metric" field AND append the framing quote that informed the choice: "metric": "<BenchmarkMetricName> [framing: '<relevant phrase>']"
Step M3 — If no suitable entry exists after steps a–c → classify "not-in-library". Stop.

─── NP CLASSIFICATION — DETERMINISTIC ALGORITHM ───────────────────────────────
After matching the metric, apply these steps IN ORDER. Stop at the first match.

Step C1 — Parse PLAUSIBLE range endpoints (both endpoints INCLUSIVE):
  "65–82%" → PLAUS_LOW=65, PLAUS_HIGH=82
  "14–24 mo" → PLAUS_LOW=14, PLAUS_HIGH=24
  Convert claim value to the same unit as the benchmark before comparing.

Step C2 — Compare: if PLAUS_LOW ≤ value ≤ PLAUS_HIGH → "in-range". Stop.
  ENDPOINT RULE: value equal to PLAUS_LOW or PLAUS_HIGH is ALWAYS "in-range".

Step C3 — If BOUNDARY range is defined, parse it (one or two sub-ranges):
  One-sided: "55–65%" → BOUND_LOW=55, BOUND_HIGH=65
  Two-sided: "12–14 / 24–30 mo" → sub-range A=[12,14], sub-range B=[24,30]
  If value falls in ANY boundary sub-range (BOUND_LOW ≤ value ≤ BOUND_HIGH) → "boundary". Stop.
  ENDPOINT RULE: value equal to inner boundary edge (same as PLAUS_LOW or PLAUS_HIGH) → "in-range" wins.

Step C4 — If NO BOUNDARY range defined but value is outside Plausible → "boundary". Stop.
  (CROSS entries and typology entries without a boundaryRange field fall here — they never produce "out-of-range" since no OOR threshold is defined.)

Step C5 — If OOR threshold defined:
  Parse "<X" → OOR if value < X (strictly less; value = X is still "boundary").
  Parse ">X" → OOR if value > X (strictly greater; value = X is still "boundary").
  If value meets OOR threshold AND no justification → "out-of-range". Stop.
  If value meets OOR threshold AND memo provides justification → classify oor-justified-j1/j2/j3. Stop.

Step C6 — If value is outside Plausible AND outside any defined Boundary AND no OOR threshold → "boundary". Stop.

Justification tiers (for oor-justified):
• oor-justified-j1 — memo cites a primary source (filed document, survey, direct measurement)
• oor-justified-j2 — memo cites a named secondary source (analyst report, published study)
• oor-justified-j3 — memo gives an explicit business-model explanation without external citation

Tie-break summary: "in-range" always wins over "boundary" at shared endpoints. "boundary" always wins over "out-of-range" when the OOR threshold is the boundary endpoint.

─── CC CERTAINTY VOCABULARY — ANCHOR WORD LIST ────────────────────────────────
Assign certainty_vocab by the STRONGEST certainty word in the quoted claim:

"definitive" — triggered by: will, is, are, has, have, does, generates, produces,
  achieves, delivers, guarantees, the [metric] is [number], [number] [metric]
  (no qualifier). Use when the claim makes a flat statement with no hedging.

"moderate" — triggered by: should, expect, projected, forecast, estimated,
  anticipated, plan to, target, on track to, likely to. Use when the claim
  includes a planning or forecast qualifier.

"hedged" — triggered by: may, might, could, would, potentially, possibly,
  approximately, roughly, up to, as much as, if [condition]. Use when the claim
  includes an explicit uncertainty or conditionality qualifier.

Tie-break: when both definitive and hedged words appear in the same sentence,
classify as "hedged" (the weaker certainty governs).

─── CC EVIDENCE TIERS ──────────────────────────────────────────────────────────
Tier 1 (no penalty at any certainty level):
  Filed documents (10-K, S-1, prospectus), primary surveys with stated methodology,
  direct measurements, government statistics.

Tier 2 (penalty only if "definitive"):
  Named third-party analyst reports (Gartner, IDC, McKinsey, etc.),
  published academic papers, named industry association studies.

Tier 3 (penalty if "definitive" OR "moderate"):
  Memo's own estimates/projections, unnamed "industry sources", management
  commentary without citation, inferred figures, "per our analysis".

Weakest-source rule (AG-5): if multiple sources back one claim, use the lowest tier.

CC penalty table:
  Tier 1 + any certainty   → 0
  Tier 2 + definitive      → -0.5
  Tier 2 + moderate/hedged → 0
  Tier 3 + definitive      → -1.0
  Tier 3 + moderate        → -0.5
  Tier 3 + hedged          → 0

─── FIC TESTS — MECHANICAL PASS/FAIL/NA ────────────────────────────────────────
For each test, follow EXACTLY these three steps, then emit "fic_test_reasons":
  Step 1 — LOCATE: find the required figures verbatim in the memo. Quote them.
  Step 2 — DECIDE: apply the rule below. NA if any required figure is absent.
  Step 3 — REASON: one sentence quoting the figures and showing the arithmetic
            (or explaining why NA), stored in fic_test_reasons.

TEST 1 — revenue_to_headcount
  Requires: (a) an explicit annual revenue or ARR figure AND (b) an explicit
  headcount or team-size figure.
  NA if: either (a) or (b) is absent from the memo text. Do NOT infer or estimate.
  Compute: revenue_per_head = (a) ÷ (b)
  PASS: revenue_per_head is between $25,000 and $10,000,000 per person
  FAIL: revenue_per_head is outside that range (order-of-magnitude inconsistency)

TEST 2 — revenue_to_margin
  Requires: (a) an explicit revenue figure AND (b) an explicit margin % or margin $ figure.
  NA if: either is absent.
  Compute: if margin is %, implied_margin_$ = revenue × margin%. If margin is $, use directly.
  PASS: implied_margin_$ ≥ 0 AND implied_margin_$ ≤ revenue (coherent — margin cannot exceed revenue)
  FAIL: implied_margin_$ > revenue, OR stated margin % is positive but implies negative dollars, OR the two figures are arithmetically contradictory

TEST 3 — capital_to_plan
  Requires: (a) an explicit capital ask ($) AND (b) an explicit team size (headcount)
  AND (c) an explicit implementation timeline (months or years).
  NA if: (a) is absent. If (b) or (c) is absent but (a) is present, score as NA.
  Compute: monthly_burn_per_person = (a) ÷ ((b) × timeline_in_months)
  PASS: monthly_burn_per_person is between $2,000 and $100,000 per person per month
  FAIL: monthly_burn_per_person is outside $500–$500,000 (implausible for any software/services project)

TEST 4 — growth_to_tam
  Requires: (a) an explicit TAM figure AND (b) an explicit revenue projection at
  a stated future year/horizon.
  NA if: either is absent.
  PASS: revenue projection at every stated horizon ≤ TAM
  FAIL: any stated revenue projection exceeds the TAM (mathematically impossible market share)

TEST 5 — timeline_to_milestone
  STEP T1 — ENUMERATE (do this FIRST, before any verdict):
    List every explicit timeline and dependency statement in the memo. Include:
    • Every calendar date, quarter reference (Q1, Q2…), month range (Months 1–3, Months 4–6)
    • Every sequencing claim ("A must precede B", "after X, then Y", "depends_on")
    • Every stated sales-cycle, ramp duration, or conversion window ("9-month sales cycle",
      "60-day onboarding", "3-month pilot")
    List them ALL before deciding anything. Do not stop at the first chain found.

  STEP T2 — EVALUATE the complete enumerated set:
    Check every enumerated dependency for:
    (a) Date conflicts: the same milestone or phase is scheduled in two incompatible windows
        (e.g., shadow pilot in both "Months 1–3" AND "Months 4–6")
    (b) Logical contradictions: stated duration makes a dependency impossible
        (e.g., LOIs signed in Q3 cannot convert within Q4 if the stated sales cycle is 9–12 months)
    (c) Reversed sequencing: B is scheduled before A when A is declared a prerequisite of B

  STEP T3 — DECIDE using the most critical result across ALL enumerated statements:
    FAIL  — if ANY pair of enumerated statements is contradictory per checks (a), (b), or (c) above.
            Quote BOTH conflicting statements verbatim in the reason.
    PASS  — if at least one dependency chain is found AND all enumerated dependencies are
            mutually consistent AND every A-date < B-date with gap ≥ 1 month.
    NA    — ONLY if the enumerated list is EMPTY (zero explicit timeline or dependency statements
            found). NA is NOT valid when statements exist but are individually consistent.

─── OUTPUT SCHEMA ──────────────────────────────────────────────────────────────
{
  "claim_count": <integer — count of scoreable financial claims BEFORE any classification>,

  "np_claims": [
    {
      "quote": "<exact quote from memo>",
      "metric": "<metric name matching benchmark entry, or 'not-in-library'>",
      "value": <numeric value>,
      "unit": "<unit string>",
      "classification": "in-range|boundary|out-of-range|oor-justified-j1|oor-justified-j2|oor-justified-j3|not-in-library"
    }
  ],

  "cc_records": [
    {
      "quote": "<exact quote from memo>",
      "certainty_vocab": "definitive|moderate|hedged",
      "evidence_tier": <1|2|3>,
      "penalty": <0 | -0.5 | -1.0>
    }
  ],

  "fic_tests": {
    "revenue_to_headcount": "PASS|FAIL|NA",
    "revenue_to_margin": "PASS|FAIL|NA",
    "capital_to_plan": "PASS|FAIL|NA",
    "growth_to_tam": "PASS|FAIL|NA",
    "timeline_to_milestone": "PASS|FAIL|NA"
  },

  "fic_test_reasons": {
    "revenue_to_headcount": "<quote figures, show arithmetic or explain NA>",
    "revenue_to_margin": "<quote figures, show arithmetic or explain NA>",
    "capital_to_plan": "<quote figures, show arithmetic or explain NA>",
    "growth_to_tam": "<quote figures, show arithmetic or explain NA>",
    "timeline_to_milestone": "<list all enumerated timeline statements, then state which comparison decided the verdict and quote any conflicting statements>"
  },

  "agent_self_reported_ori": <float 1.0-5.0 — your holistic estimate for calibration tracking only>
}

Remember: You are classifying, not scoring. The server computes ORI from these classifications.`;

  return {
    system,
    messages: [{ role: "user", content: userContent }],
  };
}
