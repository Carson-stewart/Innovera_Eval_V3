/**
 * lib/framing/prompts/pass0.ts
 *
 * Pass 0 — Structure detection and typology inference.
 *
 * Parses the 8 canonical framing sections and detects typology via the §3.3 ladder:
 *   1. Decision-block language (strongest signal)
 *   2. Context signals (investment vs initiative vs market vs product)
 *   3. Constraints signals (external capital vs internal budget vs new territory vs new SKU)
 *
 * Output shape: Pass0Output (see lib/framing/types.ts)
 */

import type { PromptPayload } from "../types";

// ---------------------------------------------------------------------------
// The 8 canonical framing sections
// ---------------------------------------------------------------------------

const CANONICAL_SECTIONS = [
  "Decision Question",
  "Scope",
  "Typology",
  "Decision Authority",
  "Timeline",
  "Success Criteria / Objectives",
  "Kill Conditions",
  "Constraints",
  "Assumptions",
  "Risks / Key Risks",
  "Blocking Questions",
  "Stakeholders",
] as const;

// ---------------------------------------------------------------------------
// Typology ladder definition (verbatim from §3.3 of the framework spec)
// ---------------------------------------------------------------------------

const TYPOLOGY_LADDER = `
TYPOLOGY DETECTION LADDER — apply in order; stop at the FIRST confident match.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 0 — COMMERCIALIZATION OVERRIDE (MANDATORY — run BEFORE everything else)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCAN the full framing for ANY of these literal keywords or phrases:
  "commercialize", "commercialization", "ARR", "MRR", "go-to-market",
  "revenue from the offering", "commercial launch", "external customers",
  "sell to", "external clients who pay", "pricing model", "sales cycle",
  "Account Executive", "AE team", "customer acquisition"

IF ANY ONE of the above is found ANYWHERE in the framing text:
  → The initiative involves selling/commercializing to external customers.
  → Typology MUST be 2B (or 2A if entering a new geography) — NEVER 1B.
  → This rule overrides the Typology section if it is incorrectly stated as 1B.
  → The fact that the organization uses its own team to BUILD it (internal development)
    does NOT make it 1B. 1B means the OUTPUT is consumed internally. If external
    parties pay for or use the output, it is NOT 1B.
  → Return the typology from Step 0 immediately; do not continue to Steps 1–3.

EXAMPLE: "Ecolab is developing and commercializing Vision AI solutions for large
grocery retailers, targeting $25M ARR within 18 months of commercial launch."
→ "commercializing", "ARR", "commercial launch" all appear → Step 0 fires → typology = 2B.

IMPORTANT: A framing's own Typology section may be incorrectly filled in (e.g., the
author wrote "1B" but the content clearly describes a product being sold to external
customers). When Step 0 signals are present, IGNORE the stated Typology field and
apply the correct typology based on content signals.

Reserve 1B exclusively for: initiatives where the OUTPUT is consumed internally by
the organization itself (internal tooling, internal process improvements, internal
org changes) with ZERO external pricing, revenue, or customer-acquisition component.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 1 — Decision-block language (if Step 0 did not fire):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • "invest in", "acquire", "fund", "equity position", "deploy capital into" → 1A
  • "build internally", "stand up [internal capability]", "allocate headcount [for
    internal use]", "internal initiative", "internal tool/platform/process" → 1B
    (ONLY if Step 0 signals are ABSENT)
  • "enter [new geography]", "expand into [new market]", "establish presence in" → 2A
  • "develop and launch [product]", "bring to market", "new product/service offering" → 2B

Step 2 — Context signals (if Step 0 and Step 1 are ambiguous):
  • External entity, third-party capital, due-diligence framing → 1A
  • Internal team, cost-center, operational framing, no external revenue → 1B
  • Geographic or vertical expansion, customer-segment framing → 2A
  • Product lifecycle, roadmap, feature-set, commercialization framing → 2B

Step 3 — Constraints signals (if Steps 0–2 are still ambiguous):
  • External capital raise, investor return, IRR, MOIC → 1A
  • Internal budget cycle, headcount cap, internal ROI, no external revenue → 1B
  • Market timing, regulatory entry, channel readiness → 2A
  • Product-market fit, time-to-market, engineering capacity, sales capacity → 2B

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONFIDENCE CALIBRATION (run AFTER selecting a typology):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before assigning confidence, perform an internal consistency check:

  1. If typology = 1B but ANY Step-0 commercialization signals are present
     → CONFLICT: override to LOW confidence and note the conflict in typologySignals.
     → Consider correcting the typology to 2B or 2A.

  2. If typology = 2B but there are no product/commercialization signals
     → CONFLICT: downgrade to LOW confidence.

  3. If the framing's explicit Typology section contradicts your detected typology
     → downgrade to MEDIUM at most; note the conflict.

Confidence assignment:
  • "high"   — Step 0 or Step 1 fired UNAMBIGUOUSLY and there are NO conflicting signals
  • "medium" — Steps 2+3 converge without Step 0/1 clarity, or minor signal conflicts
  • "low"    — signals conflict, or detected typology contradicts prominent framing features;
               set typology to null if conflict is irreconcilable
`.trim();

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildPass0Prompt(framingText: string): PromptPayload {
  const sectionList = CANONICAL_SECTIONS.map((s, i) => `  ${i + 1}. ${s}`).join("\n");

  const systemPrompt = `You are a Decision Framing Structure Analyst for Innovera Eval V3. Your task is Pass 0: extract the canonical sections of a framing document and infer its typology.

CANONICAL SECTIONS (extract ALL of the following, even if absent):
${sectionList}

${TYPOLOGY_LADDER}

OUTPUT RULES:
1. Return ONLY a valid JSON object. No prose, no markdown fences.
2. For every canonical section, emit a section entry — set "found": false and "text": "" if absent.
3. Quote typologySignals verbatim from the framing text.
4. Do NOT invent content. If a section is absent, found=false, text="".
5. typology must be one of: "1A", "1B", "2A", "2B", or null.

RESPONSE SCHEMA:
{
  "sections": [
    { "name": string, "text": string, "found": boolean }
  ],
  "typology": "1A" | "1B" | "2A" | "2B" | null,
  "typologyConfidence": "high" | "medium" | "low",
  "typologySignals": string[]
}`;

  const userPrompt = `FRAMING DOCUMENT:
---
${framingText}
---

Parse this framing document and return the Pass 0 JSON object.`;

  return {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    responseSchema:
      '{ sections: {name, text, found}[], typology: "1A"|"1B"|"2A"|"2B"|null, typologyConfidence: "high"|"medium"|"low", typologySignals: string[] }',
  };
}
