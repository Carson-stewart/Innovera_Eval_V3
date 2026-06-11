/**
 * lib/scoring/editGeneration.ts
 *
 * Generates concrete, actionable memo Edit suggestions grounded in scoring
 * traceability findings. Mirrors the sanity checker's rewrite-generation
 * approach: specific location, concrete change, no methodology prescription,
 * self-validating.
 *
 * This module is read-only with respect to DimensionScores — it only
 * reads finalized scores + traceabilityLogs and produces Edit rows.
 */

import type { DimensionResult } from "../prompts/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeneratedEdit {
  dimensionKey: string;
  location: string;   // chapter/section name
  issue: string;
  impact: string;
  fix: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function asNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
  return 0;
}

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

// ─── Traceability-aware gap derivation (replaces score-only heuristics) ──────

/**
 * For a low-scoring dimension, derive a specific, quoted finding from its
 * traceabilityLog rather than a generic "below threshold" message.
 *
 * Returns null if the score is ≥ 4.0 (no gap needed) or if no specific
 * finding can be extracted.
 */
export function deriveSpecificGap(
  dr: DimensionResult
): { issue: string; impact: string; fix: string; severity: "HIGH" | "MEDIUM" | "LOW" } | null {
  const score = dr.serverComputed ?? 0;
  if (score >= 4.0) return null;

  const severity: "HIGH" | "MEDIUM" | "LOW" = score <= 2 ? "HIGH" : "MEDIUM";
  const erosionPts = ((5 - score) * 2.5).toFixed(1);
  const log = asRecord(dr.traceabilityLog);
  const sub = asRecord(dr.subScores);
  const key = dr.dimensionKey;

  const impact = `Readiness erosion: ${erosionPts} points.`;

  switch (key) {
    case "P1": {
      const flat = asNum(log.flat_contradictions);
      const major = asNum(log.major_reconciliation_failures);
      const reasoning = asNum(log.reasoning_gaps);
      const minor = asNum(log.minor_gaps);
      const capApplied = log.minor_cap_applied === true;

      if (flat > 0) {
        return {
          severity,
          issue: `Coherence: ${flat} flat contradiction(s) — two statements that directly conflict with each other.`,
          impact,
          fix: `Locate and resolve the contradictory statements. Where two values for the same metric differ, pick one and note any intentional range explicitly.`,
        };
      }
      if (major > 0) {
        return {
          severity,
          issue: `Coherence: ${major} major reconciliation failure(s) — the same metric appears with conflicting values in different sections.`,
          impact,
          fix: `Reconcile the conflicting figures across sections. For each conflict, either unify the value or explicitly label one as a scenario variant.`,
        };
      }
      if (reasoning > 0) {
        return {
          severity,
          issue: `Coherence: ${reasoning} reasoning gap(s) where a conclusion doesn't logically follow from the stated evidence.${capApplied ? " (Minor-category penalty cap was applied.)" : ""}`,
          impact,
          fix: `Add explicit logical bridges between evidence and conclusions. Each key conclusion should cite the supporting evidence step that leads to it.`,
        };
      }
      return {
        severity,
        issue: `Coherence: ${minor} minor reconciliation inconsistency/ies found.${capApplied ? " (Combined minor penalty was capped.)" : ""}`,
        impact,
        fix: `Review the Breakdown tab's P1 traceability for the specific inconsistencies flagged, and align the conflicting expressions.`,
      };
    }

    case "P7": {
      const ficTests = asRecord(log.fic_tests);
      const ficReasons = asRecord(log.fic_test_reasons);
      const failedTests = Object.entries(ficTests).filter(([, v]) => v === "FAIL");
      const npOor = asNum(log.np_oor);
      const ccPenalties = asNum(log.cc_total_penalties);

      if (failedTests.length > 0) {
        const FIC_LABELS: Record<string, string> = {
          revenue_to_headcount: "Revenue ÷ Headcount",
          revenue_to_margin: "Revenue × Margin",
          capital_to_plan: "Capital to Plan",
          growth_to_tam: "Growth vs TAM",
          timeline_to_milestone: "Timeline to Milestone",
        };
        const failedEntries = failedTests.map(([k]) => {
          const label = FIC_LABELS[k] ?? k;
          const reason = String(ficReasons[k] ?? "").slice(0, 300);
          return `${label}: ${reason}`;
        });
        return {
          severity,
          issue: `Output Realism — Failed FIC test(s): ${failedEntries.join(" | ")}`,
          impact,
          fix: `Reconcile the internal contradiction identified above. Do not prescribe an analytical method — name the specific figures that conflict and resolve them.`,
        };
      }
      if (npOor > 0) {
        return {
          severity,
          issue: `Output Realism: ${npOor} financial claim(s) classified as out-of-range vs the benchmark library.`,
          impact,
          fix: `Either revise the out-of-range figures to plausible ranges, or add an explicit justification (cited primary source = J1, named secondary source = J2, or stated business-model rationale = J3).`,
        };
      }
      if (ccPenalties > 0) {
        return {
          severity,
          issue: `Output Realism: Claim calibration issues — ${ccPenalties.toFixed(1)} penalty point(s) from definitive language on weakly-evidenced claims.`,
          impact,
          fix: `Soften definitive claims that lack Tier-1 or Tier-2 evidence. Use "projected," "estimated," or "targeted" for figures based on internal estimates.`,
        };
      }
      return null;
    }

    case "P3": {
      const missing = Array.isArray(log.missing_chapters)
        ? (log.missing_chapters as string[])
        : [];
      const wrongTemplate = log.wrong_template === true;
      const typology = String(log.typology ?? "");

      if (wrongTemplate) {
        return {
          severity,
          issue: `Structural Accuracy: Wrong template for typology ${typology}. Missing required chapter(s): ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ` (+${missing.length - 3} more)` : ""}.`,
          impact,
          fix: `Restructure the memo to include the required chapters for typology ${typology}. Each missing chapter needs its expected sub-sections.`,
        };
      }
      if (missing.length > 0) {
        return {
          severity,
          issue: `Structural Accuracy: ${missing.length} required chapter(s) absent: ${missing.join(", ")}.`,
          impact,
          fix: `Add the missing chapter(s). Each requires its typology-mandated sub-sections and analysis.`,
        };
      }
      return null;
    }

    case "P2": {
      const fidScore = asNum(sub.fidelityScore ?? log.fidelity_score);
      const gapScore = asNum(sub.gapFillingScore ?? log.gap_filling_score);
      const execScore = asNum(sub.executabilityScore ?? log.executability_score);
      const minVal = Math.min(fidScore, gapScore, execScore);

      if (fidScore === minVal && fidScore > 0) {
        return {
          severity,
          issue: `Problem Formulation: Fidelity to the framing question is low (${fidScore.toFixed(2)}/5) — the memo may be addressing a nearby question rather than the exact decision framed.`,
          impact,
          fix: `Re-read the framing's Core Question. Ensure the recommendation section directly and explicitly answers it. Check that each blocking question from the framing has a corresponding memo section.`,
        };
      }
      if (gapScore === minVal && gapScore > 0) {
        return {
          severity,
          issue: `Problem Formulation: Gap-filling is low (${gapScore.toFixed(2)}/5) — some blocking questions from the framing are not addressed.`,
          impact,
          fix: `Review the framing's blocking questions and add dedicated sections for any not yet addressed.`,
        };
      }
      return {
        severity,
        issue: `Problem Formulation: Executability is low (${execScore.toFixed(2)}/5) — recommended actions lack measurable gates.`,
        impact,
        fix: `For each recommended action add: (1) a measurable success criterion, (2) an explicit kill condition, and (3) a specific time-bound deadline.`,
      };
    }

    case "P4": {
      const opts = asNum(sub.optionsScore ?? log.options_score);
      const scen = asNum(sub.scenariosScore ?? log.scenarios_score);
      const sens = asNum(sub.sensitivitiesScore ?? log.sensitivities_score);
      const ia = asNum(sub.iaScore ?? log.ia_score);
      const minVal = Math.min(opts, scen, sens, ia);
      const minName = minVal === opts ? "options" : minVal === scen ? "scenarios" : minVal === sens ? "sensitivities" : "interpretive alternatives";

      return {
        severity,
        issue: `Coverage: "${minName}" sub-dimension is weakest (${minVal.toFixed(2)}/5) — the analysis didn't fully explore the decision space.`,
        impact,
        fix: `Strengthen ${minName}: ${minName === "options" ? "add at least one distinct alternative with a head-to-head comparison" : minName === "scenarios" ? "add best/worst/base scenarios with quantified outcome ranges" : minName === "sensitivities" ? "add a sensitivity test showing how the recommendation changes under different key assumptions" : "add explicit counterarguments and address each one"}.`,
      };
    }

    case "P5": {
      const ciScore = asNum(sub.citationDensityScore ?? log.citation_density_score);
      const sqScore = asNum(sub.sourceQualityScore ?? log.source_quality_score);
      const ptScore = asNum(sub.provenanceTaggingScore ?? log.provenance_tagging_score);
      const redFlags = asNum(log.red_flag_count);
      const per100 = asNum(log.per_100_lines);

      if (redFlags > 0) {
        return {
          severity,
          issue: `Evidence Quality: ${redFlags} red-flag domain(s) detected — source quality score capped at 3.0.`,
          impact,
          fix: `Replace the red-flag sources with Tier-1 (filed documents, primary data) or Tier-2 (named analyst reports) sources for the affected claims.`,
        };
      }
      if (ciScore <= 2) {
        return {
          severity,
          issue: `Evidence Quality: Citation density is low (${per100.toFixed(1)} citations/100 lines) — many claims lack sources.`,
          impact,
          fix: `Add citations to load-bearing claims, targeting ≥6 citations per 100 lines. Prioritise financial projections, market size claims, and competitive positioning.`,
        };
      }
      if (ptScore <= 2) {
        return {
          severity,
          issue: `Evidence Quality: Provenance tagging is weak (${ptScore.toFixed(2)}/5) — figures can't be traced to their origin.`,
          impact,
          fix: `Tag every figure with its source type (Client, Platform, or External). Consider adding a provenance table if multiple assumption sources are present.`,
        };
      }
      return {
        severity,
        issue: `Evidence Quality: Combined EQI is ${score.toFixed(2)}/5 (citation density: ${ciScore.toFixed(2)}, source quality: ${sqScore.toFixed(2)}, provenance: ${ptScore.toFixed(2)}).`,
        impact,
        fix: `Address the lowest sub-score first (see Breakdown tab for specific counts).`,
      };
    }

    case "P6": {
      const idScore = asNum(sub.identificationScore ?? log.identification_score);
      const attrScore = asNum(sub.attributionScore ?? log.attribution_score);
      const sensScore = asNum(sub.sensitivityAwarenessScore ?? log.sensitivity_awareness_score);
      const minVal = Math.min(idScore, attrScore, sensScore);

      if (idScore === minVal) {
        return {
          severity,
          issue: `Assumption Quality: Assumptions are not gathered in a dedicated section (identification ${idScore.toFixed(2)}/5).`,
          impact,
          fix: `Add a dedicated Assumptions section. List all material assumptions, each tagged as Client-provided or Platform-derived.`,
        };
      }
      if (attrScore === minVal) {
        return {
          severity,
          issue: `Assumption Quality: Assumptions lack source attribution (attribution ${attrScore.toFixed(2)}/5).`,
          impact,
          fix: `For each assumption, add a source tag: "(Client)" for client-stated inputs, or a named source for platform-derived figures.`,
        };
      }
      return {
        severity,
        issue: `Assumption Quality: Assumptions are not linked to validation methods (sensitivity awareness ${sensScore.toFixed(2)}/5).`,
        impact,
        fix: `For each high-impact assumption, add a validation threshold: the specific value that, if crossed, would change the recommendation.`,
      };
    }

    case "P8": {
      const specScore = asNum(sub.specificityScore ?? log.specificity_score);
      const archScore = asNum(sub.decisionArchitectureScore ?? log.decision_architecture_score);
      const integScore = asNum(sub.integrationScore ?? log.integration_score);
      const move8 = asNum(sub.move8Score ?? log.move8_score);
      const minVal = Math.min(specScore, archScore, integScore, move8);

      if (move8 === minVal || move8 < 3) {
        return {
          severity,
          issue: `Solution Quality: Move 8 (conviction calibration) is low (${move8.toFixed(2)}/5) — recommendation confidence doesn't match analysis breadth.`,
          impact,
          fix: `Either (a) strengthen the Coverage analysis to justify the current conviction, or (b) temper the recommendation language to match the current analysis depth.`,
        };
      }
      if (archScore === minVal) {
        return {
          severity,
          issue: `Solution Quality: Decision architecture is weak (${archScore.toFixed(2)}/5) — recommended actions lack gates or kill conditions.`,
          impact,
          fix: `For each recommended action, specify a success gate, a kill condition, and a named decision owner.`,
        };
      }
      if (specScore === minVal) {
        return {
          severity,
          issue: `Solution Quality: Recommendation specificity is low (${specScore.toFixed(2)}/5) — lacks quantification or named entities.`,
          impact,
          fix: `Make the recommendation specific: add the dollar amount, named entity (vendor/partner/product), and the exact approval decision being sought.`,
        };
      }
      return {
        severity,
        issue: `Solution Quality: Integration is low (${integScore.toFixed(2)}/5) — actions don't chain with explicit evidence links.`,
        impact,
        fix: `For each recommendation, add an explicit Q/A/Basis link from the finding that drives it.`,
      };
    }

    default:
      return null;
  }
}

// ─── Edit generation prompt ───────────────────────────────────────────────────

/**
 * Build a single prompt that asks the model to generate concrete edits
 * for all low-scoring pillars. Returns the system prompt and user content.
 */
export function buildEditGenerationPrompt(
  lowScoringResults: DimensionResult[],
  memoContent: string,
  pillarNames: Record<string, string>
): { system: string; messages: Array<{ role: "user" | "assistant"; content: string }> } {
  const system = `You are a memo quality editor for Innovera Eval V3.
Your task: for each flagged scoring finding, generate 1–3 concrete, actionable edit suggestions that would improve the memo.

HARD RULES — apply to every edit:
1. TARGET a specific section or chapter of the memo by name.
2. STATE the exact change: what text to add, revise, or restructure. Be specific.
3. NO methodology prescription: name WHAT to fix (e.g. "reconcile the Q4 timeline with the 9-12 month sales cycle"), NOT HOW to analyze it (never say "conduct a survey," "run a model," "analyse the data").
4. SELF-VALIDATE: the proposed edit must not introduce a new contradiction while fixing the old one. Do not create a new coherence issue.
5. CROSS-REFERENCE: if one edit fixes multiple findings, note the others as fixed in the "fix" text.

Return ONLY a JSON object — no prose, no markdown fences:
{
  "edits": [
    {
      "dimensionKey": "<P1|P2|...|P8>",
      "location": "<exact chapter or section name>",
      "issue": "<one sentence: what is wrong and where>",
      "impact": "<confidence erosion and downstream effect>",
      "fix": "<concrete, specific edit instruction — no methodology>",
      "severity": "<HIGH|MEDIUM|LOW>"
    }
  ]
}`;

  const pillarBlocks = lowScoringResults
    .map((dr) => {
      const score = dr.serverComputed ?? 0;
      const name = pillarNames[dr.dimensionKey] ?? dr.dimensionKey;
      const erosionPts = ((5 - score) * 2.5).toFixed(1);
      const gap = deriveSpecificGap(dr);
      const findingSummary = gap?.issue ?? `Score ${score.toFixed(2)}/5`;

      // Include key traceability fields inline
      const log = asRecord(dr.traceabilityLog);
      let traceExtra = "";

      if (dr.dimensionKey === "P7") {
        const ficTests = asRecord(log.fic_tests);
        const ficReasons = asRecord(log.fic_test_reasons);
        const failed = Object.entries(ficTests)
          .filter(([, v]) => v === "FAIL")
          .map(([k]) => `  - ${k}: ${String(ficReasons[k] ?? "").slice(0, 400)}`);
        if (failed.length > 0) {
          traceExtra = `\nFailed FIC tests:\n${failed.join("\n")}`;
        }
      } else if (dr.dimensionKey === "P1") {
        const major = asNum(log.major_reconciliation_failures);
        const flat = asNum(log.flat_contradictions);
        if (flat > 0) traceExtra = `\n${flat} flat contradiction(s).`;
        else if (major > 0) traceExtra = `\n${major} major reconciliation failure(s).`;
      }

      return `── ${dr.dimensionKey} — ${name} (score: ${score.toFixed(2)}/5, erosion: ${erosionPts} pts) ──
Finding: ${findingSummary}${traceExtra}`;
    })
    .join("\n\n");

  // Trim memo content to keep prompt manageable (scored sections only, approx 40k chars)
  const trimmedMemo = memoContent.length > 50_000
    ? memoContent.slice(0, 50_000) + "\n\n[...memo truncated for prompt length...]"
    : memoContent;

  const userContent = `SCORING FINDINGS TO ADDRESS:

${pillarBlocks}

MEMO CONTENT:
---
${trimmedMemo}
---

Generate concrete edits for each finding above. Return the JSON object only.`;

  return {
    system,
    messages: [{ role: "user", content: userContent }],
  };
}
