import { inngest } from "../client";
import { prisma } from "@/lib/db";
import { callModelJSON } from "@/lib/openrouter";
import { CHECKS_BY_CATEGORY } from "@/lib/framing/checks";
import type { FramingCheck } from "@/lib/framing/checks";

// ─── Payload ─────────────────────────────────────────────────────────────────

interface SanityCheckPayload {
  // The API route emits framingDocId; accept both spellings so old cached
  // events aren't broken, but the canonical key is framingDocId.
  framingDocId?: number;
  framingId?: number;
}

// ─── Check result shape (per architectural spec) ──────────────────────────────

interface CheckResult {
  checkId: string;
  evaluator: "primary";
  status: "PASS" | "FAIL" | "NA" | "ADVISORY";
  confidence: number; // 0–1
  location: string | null;
  issue: string | null;
  impact: string | null;
  rewrite: string | null;
}

// ─── Pass 0 output ────────────────────────────────────────────────────────────

interface Pass0Output {
  typology: string | null;
  typologyConfidence: "HIGH" | "MEDIUM" | "LOW" | null;
  structureSummary: string;
}

// ─── Per-category pass output ─────────────────────────────────────────────────

interface CategoryPassOutput {
  results: CheckResult[];
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildPass0Prompt(framingContent: string): {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
} {
  const system = `You are a Decision Framing Sanity Checker. Your task is to analyse a decision framing document and return a structured JSON object.

FRAMING DOCUMENT (sent first, as required by protocol):
---
${framingContent}
---

Return a JSON object with this exact shape:
{
  "typology": "<ONE_A|ONE_B|TWO_A|TWO_B|null>",
  "typologyConfidence": "<HIGH|MEDIUM|LOW|null>",
  "structureSummary": "<one sentence describing the framing's structure and completeness at a high level>"
}

Typology codes:
- ONE_A = 1A External Investment
- ONE_B = 1B Internal Initiative
- TWO_A = 2A New Market Entry
- TWO_B = 2B New Product Launch

If you cannot determine the typology from the framing, return null for typology and typologyConfidence.`;

  return {
    system,
    messages: [
      {
        role: "user",
        content:
          "Analyse the framing document above. Return only the JSON object — no prose, no code fences.",
      },
    ],
  };
}

function buildCategoryPrompt(
  category: "A" | "B" | "C" | "D",
  checks: FramingCheck[],
  framingContent: string,
  isAdvisoryCategory: boolean
): { system: string; messages: Array<{ role: "user" | "assistant"; content: string }> } {
  const categoryDescriptions: Record<"A" | "B" | "C" | "D", string> = {
    A: "Logical Integrity (ADVISORY ONLY — all findings are Enhancement severity; Client-Stated Input Protocol runs first)",
    B: "Completeness",
    C: "Structural Integrity",
    D: "Rule Compliance",
  };

  const checksJson = checks.map((c) => ({
    id: c.id,
    name: c.name,
    severity: c.severity,
    failCriteria: c.failCriteria,
    naCondition: c.naCondition,
    recommendationForm: c.recommendationForm,
  }));

  const advisoryNote = isAdvisoryCategory
    ? `\nCRITICAL CONSTRAINT: Category A checks are ADVISORY ONLY. You MUST return status "ADVISORY" (never "FAIL") for any finding in this category. Client-Stated Input Protocol: before evaluating any check, verify whether the element under review was explicitly provided by the client as a given input. If so, do not flag it.\n`
    : `\nClient-Stated Input Protocol: before evaluating any check, verify whether the element under review was explicitly provided by the client as a given input. If so, return status "NA" rather than "FAIL".\n`;

  const system = `You are a Decision Framing Sanity Checker evaluating Category ${category} — ${categoryDescriptions[category]}.
${advisoryNote}
FRAMING DOCUMENT (sent first, as required by protocol):
---
${framingContent}
---

You will evaluate the following ${checks.length} checks in category ${category}. For each check, apply the failCriteria and naCondition exactly as specified.

CHECKS TO EVALUATE:
${JSON.stringify(checksJson, null, 2)}

Return a JSON object with this exact shape:
{
  "results": [
    {
      "checkId": "<e.g. A1>",
      "evaluator": "primary",
      "status": "<PASS|FAIL|NA${isAdvisoryCategory ? "|ADVISORY" : ""}>",
      "confidence": <0.0 to 1.0>,
      "location": "<quoted text from the framing that triggered this finding, or null if PASS/NA>",
      "issue": "<one sentence describing the specific problem found, or null if PASS/NA>",
      "impact": "<one sentence describing downstream effect on memo quality, or null if PASS/NA>",
      "rewrite": "<suggested corrected text or structural fix, or null if PASS/NA>"
    }
  ]
}

${isAdvisoryCategory ? 'For Category A: use "ADVISORY" instead of "FAIL" for any finding. Never return status "FAIL" in Category A.' : ""}
Return exactly ${checks.length} result objects — one per check, in the same order as the checks list above.`;

  return {
    system,
    messages: [
      {
        role: "user",
        content: `Evaluate all ${checks.length} Category ${category} checks against the framing document above. Return only the JSON object.`,
      },
    ],
  };
}

// ─── Verdict computation (server-side — model never sets this) ────────────────

interface VerdictInput {
  allResults: CheckResult[];
}

type SanityVerdictValue =
  | "READY_FOR_ANALYSIS"
  | "READY_FOR_DELIVERY"
  | "REVISIONS_REQUIRED"
  | "MAJOR_REWORK_NEEDED";

function computeVerdict(input: VerdictInput): {
  verdict: SanityVerdictValue;
  passCount: number;
  failCount: number;
  enhanceCount: number;
  advisoryCount: number;
} {
  const { allResults } = input;

  // Count by status (Category A ADVISORY never contributes to failCount)
  const passCount = allResults.filter((r) => r.status === "PASS").length;
  const failCount = allResults.filter((r) => r.status === "FAIL").length;
  const enhanceCount = allResults.filter((r) => r.status === "ADVISORY").length;
  const advisoryCount = enhanceCount;

  // Identify severity classes of failing checks
  // We need to join back to check definitions for severity
  const failingCheckIds = new Set(
    allResults.filter((r) => r.status === "FAIL").map((r) => r.checkId)
  );

  // Pull check metadata from the static check lists
  const allChecks = [
    ...CHECKS_BY_CATEGORY.A,
    ...CHECKS_BY_CATEGORY.B,
    ...CHECKS_BY_CATEGORY.C,
    ...CHECKS_BY_CATEGORY.D,
  ];

  const failingChecks = allChecks.filter((c) => failingCheckIds.has(c.id));
  const criticalFails = failingChecks.filter((c) => c.severity === "Critical");
  const structuralFails = failingChecks.filter((c) => c.severity === "Structural");

  // D15 lone-fail carve-out: D15 fail alone does NOT trigger Revisions Required
  const nonD15Fails = failingChecks.filter((c) => c.id !== "D15");
  const criticalNonD15 = criticalFails.filter((c) => c.id !== "D15");
  const structuralNonD15 = structuralFails.filter((c) => c.id !== "D15");

  // Count failing D-category checks {D1, D2, D3} (for MAJOR_REWORK test)
  const d1d2d3Fails = failingChecks.filter((c) => ["D1", "D2", "D3"].includes(c.id));

  // C10 check
  const c10Fails = failingChecks.some((c) => c.id === "C10");

  // ── Verdict rules (evaluated in priority order) ───────────────────────────
  //
  // MAJOR_REWORK_NEEDED: 3+ Critical OR C10 fails OR 2+ of {D1,D2,D3} fail
  if (
    criticalFails.length >= 3 ||
    c10Fails ||
    d1d2d3Fails.length >= 2
  ) {
    return { verdict: "MAJOR_REWORK_NEEDED", passCount, failCount, enhanceCount, advisoryCount };
  }

  // REVISIONS_REQUIRED: any Critical (non-D15 context) OR >2 Structural
  // D15 lone-fail carve-out: if D15 is the ONLY failing check, do not trigger REVISIONS_REQUIRED
  const onlyD15Fails = failCount === 1 && failingCheckIds.has("D15");

  if (!onlyD15Fails && (criticalNonD15.length > 0 || structuralNonD15.length > 2)) {
    return { verdict: "REVISIONS_REQUIRED", passCount, failCount, enhanceCount, advisoryCount };
  }

  // Also trigger REVISIONS_REQUIRED if D15 fails along with any other failure
  // (the carve-out only applies when D15 is the sole failure)
  if (failCount > 0 && !onlyD15Fails) {
    // Covers: 1–2 Structural fails (non-D15), or D15 + other fails
    if (structuralNonD15.length > 0 || criticalNonD15.length > 0) {
      return { verdict: "REVISIONS_REQUIRED", passCount, failCount, enhanceCount, advisoryCount };
    }
  }

  // READY_FOR_DELIVERY: 0 Critical AND ≤2 Structural (any Enhancements/Advisories OK)
  // (also covers the D15-lone-fail carve-out case: D15 alone → still READY_FOR_DELIVERY)
  if (criticalNonD15.length === 0 && structuralNonD15.length <= 2) {
    // Distinguish READY_FOR_DELIVERY (all issues addressed) vs READY_FOR_ANALYSIS
    // READY_FOR_DELIVERY = 0 Critical AND ≤2 Structural
    // READY_FOR_ANALYSIS = passes but may have minor issues
    // Both map to the same tier of "no blocking issues" in this rubric;
    // use READY_FOR_DELIVERY when there are zero FAIL statuses (or only D15)
    // and READY_FOR_ANALYSIS otherwise (0–2 Structural only).
    if (failCount === 0 || onlyD15Fails) {
      return { verdict: "READY_FOR_DELIVERY", passCount, failCount, enhanceCount, advisoryCount };
    }
    // 1–2 structural fails present but within threshold
    return { verdict: "READY_FOR_ANALYSIS", passCount, failCount, enhanceCount, advisoryCount };
  }

  // Fallback (should not be reached given exhaustive rules above)
  return { verdict: "REVISIONS_REQUIRED", passCount, failCount, enhanceCount, advisoryCount };
}

// ─── Helper: build triage matrix ─────────────────────────────────────────────

function buildTriageMatrix(allResults: CheckResult[]): Record<string, string> {
  const matrix: Record<string, string> = {};
  for (const r of allResults) {
    matrix[r.checkId] = r.status;
  }
  return matrix;
}

// ─── Helper: map CheckResult severity to SanityIssue severity ────────────────

function mapSeverity(checkId: string): "HIGH" | "MEDIUM" | "LOW" {
  const allChecks = [
    ...CHECKS_BY_CATEGORY.A,
    ...CHECKS_BY_CATEGORY.B,
    ...CHECKS_BY_CATEGORY.C,
    ...CHECKS_BY_CATEGORY.D,
  ];
  const check = allChecks.find((c) => c.id === checkId);
  if (!check) return "MEDIUM";
  switch (check.severity) {
    case "Critical":
      return "HIGH";
    case "Structural":
      return "MEDIUM";
    case "Enhancement":
      return "LOW";
    default:
      return "MEDIUM";
  }
}

function mapCategory(checkId: string): string {
  if (checkId.startsWith("A")) return "A";
  if (checkId.startsWith("B")) return "B";
  if (checkId.startsWith("C")) return "C";
  if (checkId.startsWith("D")) return "D";
  return "UNKNOWN";
}

function getFidelityTier(checkId: string): string {
  const allChecks = [
    ...CHECKS_BY_CATEGORY.A,
    ...CHECKS_BY_CATEGORY.B,
    ...CHECKS_BY_CATEGORY.C,
    ...CHECKS_BY_CATEGORY.D,
  ];
  const check = allChecks.find((c) => c.id === checkId);
  return check?.fidelity ?? "MEDIUM";
}

function getEvidenceBasis(checkId: string): string {
  const allChecks = [
    ...CHECKS_BY_CATEGORY.A,
    ...CHECKS_BY_CATEGORY.B,
    ...CHECKS_BY_CATEGORY.C,
    ...CHECKS_BY_CATEGORY.D,
  ];
  const check = allChecks.find((c) => c.id === checkId);
  return check?.evidenceBasis ?? "Structurally inferred";
}

// ─── Inngest function ─────────────────────────────────────────────────────────

export const sanityCheck = inngest.createFunction(
  {
    id: "sanity-check",
    name: "Framing Sanity Check",
    triggers: [{ event: "framing/sanity-check.requested" }],
  },
  async ({
    event,
    step,
  }: {
    event: { data: SanityCheckPayload };
    step: {
      run: <T>(id: string, fn: () => Promise<T>) => Promise<T>;
    };
  }) => {
    // Accept both framingDocId (canonical) and framingId (legacy) so cached
    // runs from before the field-name fix don't break.
    const framingId = event.data.framingDocId ?? event.data.framingId;

    // ─── Step 1: Load framing ───────────────────────────────────────────────
    // Guard BEFORE the step so a missing/undefined id never gets cached as a
    // successful step result (mirrors the scoreMemo load-inputs guard pattern).
    if (typeof framingId !== "number" || !Number.isFinite(framingId)) {
      throw new Error(
        `sanityCheck: framingId is missing or invalid in event payload ` +
          `(received: ${JSON.stringify(framingId)}). ` +
          `The run route must emit framingDocId as a number.`
      );
    }

    const framing = await step.run("load-framing", async () => {
      const record = await prisma.framing.findUniqueOrThrow({
        where: { id: framingId },
      });

      if (!record.content || record.content.trim().length === 0) {
        throw new Error(
          `load-framing: framing ${framingId} has empty content. ` +
            `Aborting so this result is not cached.`
        );
      }

      return record;
    });

    // ─── Step 2: Pass 0 — structure + typology detection ───────────────────
    const pass0Raw = await step.run("pass0-structure", async () => {
      const prompt = buildPass0Prompt(framing.content);
      return await callModelJSON<Pass0Output>({
        system: prompt.system,
        messages: prompt.messages,
      });
    });

    // ─── Server-side commercialization override ─────────────────────────────
    // The model may follow the framing's stated Typology section literally even
    // when the content clearly indicates commercialization to external customers.
    // If the framing contains commercialization signals AND Pass 0 returned 1B,
    // correct it to 2B here so all downstream category passes use the right type.
    const COMMERCIALIZATION_SIGNALS = [
      "commercialize", "commercialization", " ARR", "MRR",
      "go-to-market", "commercial launch", "external customers",
      "sales cycle", "Account Executive", " AE ", "pricing model",
      "revenue from the offering", "revenue from the solution",
    ];
    const framingLower = framing.content.toLowerCase();
    const hasCommercializationSignal = COMMERCIALIZATION_SIGNALS.some((sig) =>
      framingLower.includes(sig.toLowerCase())
    );

    // Normalize model output: the prompt template uses ONE_B/TWO_A etc. while the
    // output rules say 1A/1B etc. — handle both formats for robustness.
    const normalizeTypology = (t: string | null) => {
      if (!t) return t;
      const map: Record<string, string> = {
        "1A": "ONE_A", "1B": "ONE_B", "2A": "TWO_A", "2B": "TWO_B",
        "ONE_A": "ONE_A", "ONE_B": "ONE_B", "TWO_A": "TWO_A", "TWO_B": "TWO_B",
      };
      return map[t] ?? t;
    };

    const normalizedTypology = normalizeTypology(pass0Raw.typology);

    const pass0Result: Pass0Output =
      hasCommercializationSignal && normalizedTypology === "ONE_B"
        ? {
            ...pass0Raw,
            typology: "TWO_B",  // corrected typology
            typologyConfidence: "HIGH",
          }
        : {
            ...pass0Raw,
            typology: normalizedTypology,  // ensure consistent ONE_X/TWO_X format
          };

    // ─── Step 3: Pass 1 — Category A (advisory only) ───────────────────────
    const pass1Result = await step.run("pass1-cat-a", async () => {
      const checks = CHECKS_BY_CATEGORY.A;
      const prompt = buildCategoryPrompt("A", checks, framing.content, true);
      const raw = await callModelJSON<CategoryPassOutput>({
        system: prompt.system,
        messages: prompt.messages,
      });
      // Enforce advisory-only: override any FAIL to ADVISORY for Category A
      return {
        results: raw.results.map((r) => ({
          ...r,
          evaluator: "primary" as const,
          status: r.status === "FAIL" ? ("ADVISORY" as const) : r.status,
        })),
      };
    });

    // ─── Step 4: Pass 2 — Category B ───────────────────────────────────────
    const pass2Result = await step.run("pass2-cat-b", async () => {
      const checks = CHECKS_BY_CATEGORY.B;
      const prompt = buildCategoryPrompt("B", checks, framing.content, false);
      const raw = await callModelJSON<CategoryPassOutput>({
        system: prompt.system,
        messages: prompt.messages,
      });
      return {
        results: raw.results.map((r) => ({
          ...r,
          evaluator: "primary" as const,
        })),
      };
    });

    // ─── Step 5: Pass 3 — Category C ───────────────────────────────────────
    const pass3Result = await step.run("pass3-cat-c", async () => {
      const checks = CHECKS_BY_CATEGORY.C;
      const prompt = buildCategoryPrompt("C", checks, framing.content, false);
      const raw = await callModelJSON<CategoryPassOutput>({
        system: prompt.system,
        messages: prompt.messages,
      });
      return {
        results: raw.results.map((r) => ({
          ...r,
          evaluator: "primary" as const,
        })),
      };
    });

    // ─── Step 6: Pass 4 — Category D ───────────────────────────────────────
    const pass4Result = await step.run("pass4-cat-d", async () => {
      const checks = CHECKS_BY_CATEGORY.D;
      const prompt = buildCategoryPrompt("D", checks, framing.content, false);
      const raw = await callModelJSON<CategoryPassOutput>({
        system: prompt.system,
        messages: prompt.messages,
      });
      return {
        results: raw.results.map((r) => ({
          ...r,
          evaluator: "primary" as const,
        })),
      };
    });

    // ─── Step 7: Server verdict ─────────────────────────────────────────────
    // Model never sets the verdict. Server computes it from finding counts.
    const verdictData = await step.run("server-verdict", async () => {
      const allResults: CheckResult[] = [
        ...pass1Result.results,
        ...pass2Result.results,
        ...pass3Result.results,
        ...pass4Result.results,
      ];

      const { verdict, passCount, failCount, enhanceCount, advisoryCount } =
        computeVerdict({ allResults });

      const triageMatrix = buildTriageMatrix(allResults);

      return {
        verdict,
        passCount,
        failCount,
        enhanceCount,
        advisoryCount,
        triageMatrix,
        allResults,
      };
    });

    // ─── Step 8: Persist ────────────────────────────────────────────────────
    const sanityCheckId = await step.run("persist", async () => {
      const {
        verdict,
        passCount,
        failCount,
        enhanceCount,
        advisoryCount,
        triageMatrix,
        allResults,
      } = verdictData;

      // Build a revised framing stub — Pass 0 structure summary + typology
      const revisedFraming = [
        `[Sanity Check v1.0 — Auto-generated summary]`,
        `Typology detected: ${pass0Result.typology ?? "Unknown"} (confidence: ${pass0Result.typologyConfidence ?? "N/A"})`,
        `Structure: ${pass0Result.structureSummary}`,
        `Verdict: ${verdict}`,
        `Checks: ${passCount} PASS | ${failCount} FAIL | ${enhanceCount} ADVISORY`,
      ].join("\n");

      const result = await prisma.$transaction(async (tx) => {
        const sanityCheckRecord = await tx.sanityCheck.create({
          data: {
            framingId,
            verdict: verdict as
              | "READY_FOR_ANALYSIS"
              | "READY_FOR_DELIVERY"
              | "REVISIONS_REQUIRED"
              | "MAJOR_REWORK_NEEDED",
            passCount,
            failCount,
            // advisoryCount (Category A advisories) stored in enhanceCount field
            enhanceCount: advisoryCount,
            triageMatrix: triageMatrix as never,
            revisedFraming,
            typology: pass0Result.typology ?? null,
            typologyConfidence: pass0Result.typologyConfidence ?? null,
          },
        });

        // Persist issues for every non-PASS, non-NA result
        const issueResults = allResults.filter(
          (r) => r.status === "FAIL" || r.status === "ADVISORY"
        );

        for (const r of issueResults) {
          await tx.sanityIssue.create({
            data: {
              sanityCheckId: sanityCheckRecord.id,
              checkId: r.checkId,
              issue: r.issue ?? "",
              impact: r.impact ?? "",
              fix: r.rewrite ?? "",
              severity: mapSeverity(r.checkId) as "HIGH" | "MEDIUM" | "LOW",
              category: mapCategory(r.checkId),
              fidelityTier: getFidelityTier(r.checkId),
              confidence: r.confidence,
              location: r.location ?? null,
              rewrite: r.rewrite ?? null,
              evidenceBasis: getEvidenceBasis(r.checkId),
              escalated: false,
            },
          });
        }

        return sanityCheckRecord.id;
      });

      return result;
    });

    return {
      sanityCheckId,
      verdict: verdictData.verdict,
      passCount: verdictData.passCount,
      failCount: verdictData.failCount,
      enhanceCount: verdictData.enhanceCount,
      advisoryCount: verdictData.advisoryCount,
      typology: pass0Result.typology,
      typologyConfidence: pass0Result.typologyConfidence,
    };
  }
);
