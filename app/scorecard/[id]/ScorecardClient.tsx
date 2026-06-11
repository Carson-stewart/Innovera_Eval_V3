"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shell/TopBar";
import { PILLAR_EXPLANATIONS, STAGE_1_KEYS, STAGE_2_KEYS } from "@/lib/pillars/explanations";
import { PILLAR_GUIDE_DETAILS } from "@/lib/pillars/guide-details";

// ─── Types (match serialised Prisma output) ───────────────────────────────────

export interface DimensionScoreRow {
  id: number;
  dimensionKey: string;
  /** null = NOT_SCORED (e.g. P7 sparse-data protocol) — render "Not scored", never 0/−1/1 */
  score: number | null;
  serverComputed: number | null;
  agentSelfReported: number | null;
  calibrationDrift: boolean;
  subScores: Record<string, unknown>;
  traceabilityLog: Record<string, unknown>;
  /** Raw finding detail (Phase B2; P1 only for now). Null on pre-B2 runs. */
  findings?: {
    version: number;
    totalFound: number;
    truncated: boolean;
    entries: Array<{
      kind: string;
      scope: string;
      chapter?: string;
      quoteA: string;
      quoteB: string;
      description?: string;
      locations: string[];
    }>;
  } | null;
}

export interface GapRow {
  id: number;
  dimensionKey: string;
  issue: string;
  impact: string;
  fix: string;
  severity: string;
}

export interface EditRow {
  id: number;
  dimensionKey: string;
  issue: string;
  impact: string;
  fix: string;
  severity: string;
}

export interface DiagRow {
  id: number;
  type: string;
  message: string;
}

export interface RiskRow {
  id: number;
  statement: string;
  classification: string;
  source: string;
  severity: string;
  approved: boolean;
  // Informational addressed-check (CRITICAL risks only — null for others)
  addressedStatus: string | null;
  addressedNote: string | null;
}

export interface RunData {
  id: number;
  rubricVersion: string;
  memoConfidence: number;
  decisionConfidence: number;
  riskMultiplier: number;
  statusBadge: string;
  stage1Avg: number;
  stage2Avg: number;
  /** Completeness metadata: parsed scorable chapters out of the canonical 10.
   *  Null on runs scored before the column existed — display nothing then. */
  scorableChapterCount: number | null;
  /** V3 v1.1: readiness denominator — scored Stage-1 pillars (8 unless one was
   *  NOT_SCORED and excluded via rescaling). Null on pre-v1.1 runs. */
  scoredPillarCount: number | null;
  scoredAt: string;
  memo: {
    id: number;
    name: string;
    typology: string;
    notes: string | null;
    eloRecord: { rating: number; comparisonCount: number; updatedAt: string } | null;
  };
  dimensionScores: DimensionScoreRow[];
  diagnostics: DiagRow[];
  gaps: GapRow[];
  edits: EditRow[];
  confirmedRisks: RiskRow[];
  // Phase R1 redundancy diagnostic — null if not yet computed or unavailable
  redundancyAnalysis: {
    sri: number;
    claimCount: number;
    uniqueClusterCount: number;
    threshold: number;
    favoriteFriends: unknown;
    perChapterGain: unknown;
    analysisStatus: string;
    errorMessage: string | null;
  } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPOLOGY_LABELS: Record<string, string> = {
  ONE_A: "1A — External Investment",
  ONE_B: "1B — Internal Initiative",
  TWO_A: "2A — New Market Entry",
  TWO_B: "2B — New Product Launch",
};

const BADGE_STYLES: Record<string, string> = {
  READY_TO_SHIP: "bg-green-100 text-green-800 border border-green-300",
  NEEDS_WORK: "bg-amber-100 text-amber-800 border border-amber-300",
  MAJOR_REWORK: "bg-red-100 text-red-800 border border-red-300",
};

const BADGE_LABELS: Record<string, string> = {
  READY_TO_SHIP: "Ready to Ship",
  NEEDS_WORK: "Needs Work",
  MAJOR_REWORK: "Major Rework",
};

const SEV_STYLES: Record<string, string> = {
  HIGH: "bg-red-50 border border-red-200 text-red-700",
  MEDIUM: "bg-amber-50 border border-amber-200 text-amber-700",
  LOW: "bg-gray-50 border border-gray-200 text-gray-600",
};

const VERDICT_STYLES: Record<string, string> = {
  PASS: "bg-green-100 text-green-800",
  FAIL: "bg-red-100 text-red-800",
  NA: "bg-gray-100 text-gray-600",
};

const FIC_LABELS: Record<string, string> = {
  revenue_to_headcount: "Revenue ÷ Headcount",
  revenue_to_margin: "Revenue × Margin",
  capital_to_plan: "Capital to Plan",
  growth_to_tam: "Growth vs TAM",
  timeline_to_milestone: "Timeline to Milestone",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (score === null) return "text-gray-400";
  if (score >= 4) return "text-green-700";
  if (score >= 3) return "text-amber-700";
  return "text-red-700";
}

function chipStyle(score: number | null): string {
  if (score === null) return "bg-gray-50 border-gray-300 text-gray-500";
  if (score >= 4) return "bg-green-50 border-green-400 text-green-800";
  if (score >= 3) return "bg-amber-50 border-amber-400 text-amber-800";
  return "bg-red-50 border-red-400 text-red-800";
}

/** Returns null when the dimension is NOT_SCORED — callers must render "Not scored". */
function pillarScore(run: RunData, key: string): number | null {
  return run.dimensionScores.find((d) => d.dimensionKey === key)?.serverComputed ?? null;
}

function erosion(score: number): number {
  return Math.min(Math.max((5 - score) * 2.5, 0), 10);
}

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (v === null || v === undefined) return "—";
  return JSON.stringify(v);
}

function asNum(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = parseFloat(v); return isNaN(n) ? null : n; }
  return null;
}

function asArr(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  return [];
}

// ─── Recovery helpers ─────────────────────────────────────────────────────────

/** P1 coherence-conflict count from persisted subScores (display only — no recomputation).
 *  Returns null when subScores is missing/malformed so callers render a dash. */
function p1ConflictCount(run: RunData): number | null {
  const ds = run.dimensionScores.find((d) => d.dimensionKey === "P1");
  if (!ds) return null;
  const v = asRecord(ds.subScores).majorReconciliations;
  return typeof v === "number" ? v : null;
}

function computeRecovery(run: RunData) {
  return STAGE_1_KEYS.flatMap((k) => {
    const score = pillarScore(run, k);
    if (score === null) return []; // not scored — no recovery headroom claimable
    const headroom = 5 - score;
    const gain = headroom * 2.5;
    const exp = PILLAR_EXPLANATIONS[k];
    return [{ key: k, name: exp?.name ?? k, gloss: exp?.gloss ?? "", score, headroom, gain }];
  })
    .filter((p) => p.headroom > 0)
    .sort((a, b) => b.gain - a.gain);
}

function generateExplanation(run: RunData): string {
  const topErosion = STAGE_1_KEYS.flatMap((k) => {
    const score = pillarScore(run, k);
    if (score === null) return []; // not scored — contributes no erosion narrative
    const e = erosion(score);
    const name = PILLAR_EXPLANATIONS[k]?.name ?? k;
    return [{ key: k, score, erosion: e, name }];
  })
    .filter((p) => p.erosion > 0)
    .sort((a, b) => b.erosion - a.erosion)
    .slice(0, 3);

  const s2scores = STAGE_2_KEYS.map((k) => pillarScore(run, k)).filter((s): s is number => s !== null);
  const s2avg = s2scores.length > 0 ? s2scores.reduce((a, b) => a + b, 0) / s2scores.length : 0;

  let text = `This memo achieved a Memo Confidence of ${run.memoConfidence.toFixed(1)}/100 (Rubric ${run.rubricVersion}). `;

  if (topErosion.length >= 2) {
    text += `The largest readiness losses came from ${topErosion[0].name} (${topErosion[0].key} = ${topErosion[0].score.toFixed(2)}, ${topErosion[0].erosion.toFixed(1)} pts erosion) and ${topErosion[1].name} (${topErosion[1].key} = ${topErosion[1].score.toFixed(2)}, ${topErosion[1].erosion.toFixed(1)} pts erosion). `;
    if (topErosion[2])
      text += `${topErosion[2].name} (${topErosion[2].key}) contributed a further ${topErosion[2].erosion.toFixed(1)} pts. `;
  } else if (topErosion.length === 1) {
    text += `The primary readiness loss came from ${topErosion[0].name} (${topErosion[0].key} = ${topErosion[0].score.toFixed(2)}, ${topErosion[0].erosion.toFixed(1)} pts erosion). `;
  } else {
    text += "All Stage 1 pillars scored at maximum — no readiness was eroded by the analysis. ";
  }

  if (s2avg >= 3.5) {
    text += `Stage 2 (Output Quality) is strong (avg ${s2avg.toFixed(2)}), indicating polished, executive-ready presentation.`;
  } else if (s2avg >= 2.5) {
    text += `Stage 2 (Output Quality) is adequate (avg ${s2avg.toFixed(2)}) — presentation is serviceable but has room to improve.`;
  } else {
    text += `Stage 2 (Output Quality) is weak (avg ${s2avg.toFixed(2)}) — formatting, readability, and actionability need significant work.`;
  }

  return text;
}

// ─── Small shared UI atoms ────────────────────────────────────────────────────

function KV({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex items-baseline gap-2 text-xs py-0.5">
      <span className="text-gray-500 shrink-0 w-44">{label}</span>
      <span className="font-mono text-gray-800 break-all">{asString(value)}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 mt-3 first:mt-0">
      {children}
    </p>
  );
}

function Chip({ label, value, style }: { label?: string; value: string; style?: string }) {
  return (
    <span className={`inline-block text-xs rounded-full px-2 py-0.5 font-medium ${style ?? "bg-gray-100 text-gray-700"}`}>
      {label ? `${label}: ${value}` : value}
    </span>
  );
}

// ─── Traceability renderers ───────────────────────────────────────────────────

function P1Trace({ log, conflictCount, findings }: {
  log: Record<string, unknown>;
  conflictCount: number | null;
  findings: DimensionScoreRow["findings"];
}) {
  const capApplied = log.minor_cap_applied === true;
  const KIND_LABELS: Record<string, string> = {
    flat_contradiction: "Flat contradiction",
    major_reconciliation: "Major reconciliation",
    minor_reconciliation: "Minor reconciliation",
  };
  return (
    <div>
      <div className={`mb-3 rounded-lg border px-3 py-2 text-xs font-medium ${
        conflictCount !== null && conflictCount > 1
          ? "bg-red-50 border-red-200 text-red-700"
          : "bg-green-50 border-green-200 text-green-700"
      }`}>
        Coherence conflicts: <span className="font-bold">{conflictCount ?? "—"}</span> — memos ship at ≤1
      </div>
      {/* D2b: minor/reasoning channel visibility — raw signal of the saturated
          channel; the penalty itself stays capped (recalibration: Phase E). */}
      {(() => {
        const minors = asNum(log.minor_gaps);
        const drifts = asNum(log.definitional_drifts);
        const reasoning = asNum(log.reasoning_gaps);
        const raw = asNum(log.minor_combined_raw);
        const capApplied2 = log.minor_cap_applied === true;
        if (minors === null && reasoning === null) return null;
        return (
          <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            Minor gaps: <span className="font-semibold text-gray-800">{minors ?? "—"}</span>
            {drifts !== null && drifts > 0 && (
              <> · Definitional drifts: <span className="font-semibold text-gray-800">{drifts}</span></>
            )}
            {" "}· Reasoning gaps: <span className="font-semibold text-gray-800">{reasoning ?? "—"}</span>
            {raw !== null && (
              <span className="text-gray-500">
                {" "}(raw penalty {raw.toFixed(2)}, {capApplied2 ? "capped at 1.5" : "under the 1.5 cap"})
              </span>
            )}
          </div>
        );
      })()}
      {findings && findings.entries.length > 0 && (
        <div className="mb-4">
          <SectionLabel>Persisted findings ({findings.totalFound}{findings.truncated ? `, showing first ${findings.entries.length}` : ""})</SectionLabel>
          <div className="space-y-1.5">
            {findings.entries.map((f, i) => (
              <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600 leading-relaxed">
                <span className="font-semibold text-gray-700">Conflict ({KIND_LABELS[f.kind] ?? f.kind}):</span>{" "}
                &ldquo;{f.quoteA}&rdquo; <span className="text-gray-400">vs</span> &ldquo;{f.quoteB}&rdquo;{" "}
                <span className="text-gray-400">({(f.locations ?? []).join(", ") || f.chapter || "location not recorded"})</span>
                {f.description && <p className="mt-0.5 text-gray-500">{f.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
      <SectionLabel>Penalty breakdown</SectionLabel>
      <div className="rounded-lg border border-gray-100 overflow-hidden text-xs">
        {[
          ["Flat contradictions", log.flat_contradictions, `−${asString(log.flat_penalty)} pts`],
          ["Major reconciliation failures", log.major_reconciliation_failures, `−${asString(log.major_penalty)} pts`],
          ["Minor reconciliation gaps", log.minor_gaps, ""],
          ["Definitional drifts", log.definitional_drifts, ""],
          ["Reasoning gaps", log.reasoning_gaps, ""],
        ].map(([label, count, note], i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-1.5 even:bg-gray-50">
            <span className="text-gray-500 flex-1">{label as string}</span>
            <span className="font-mono font-semibold text-gray-800">{asString(count)}</span>
            {(note as string) && <span className="text-red-600 font-mono">{note as string}</span>}
          </div>
        ))}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border-t border-gray-200">
          <span className="text-gray-500 flex-1">
            Minor combined (raw {asString(log.minor_combined_raw)}{capApplied && `, capped at ${asString(log.minor_combined_cap)}`})
          </span>
          <span className="font-mono font-semibold text-gray-800">−{asString(log.minor_combined_penalty)} pts</span>
          {capApplied && <span className="text-xs bg-amber-100 text-amber-700 rounded px-1.5">cap applied</span>}
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 border-t border-gray-200">
          <span className="text-gray-500 flex-1">Tension bonus</span>
          <span className="font-mono font-semibold text-green-700">+{asString(log.tension_bonus)} pts</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border-t border-gray-200 font-semibold">
          <span className="text-gray-700 flex-1">Total penalties</span>
          <span className="font-mono text-gray-800">{asString(log.total_penalties)}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 border-t border-gray-200 font-semibold">
          <span className="text-gray-700 flex-1">Final CI</span>
          <span className={`font-mono font-bold text-base ${scoreColor(asNum(log.ci) ?? 0)}`}>{asString(log.ci)}</span>
        </div>
      </div>
    </div>
  );
}

function P3Trace({ log }: { log: Record<string, unknown> }) {
  const present = asArr(log.present_chapters);
  const missing = asArr(log.missing_chapters);
  const expected = asArr(log.expected_chapters);
  return (
    <div className="space-y-3">
      <div>
        <SectionLabel>Expected chapters ({expected.length})</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {expected.map((ch, i) => {
            const isPresent = present.includes(ch);
            return (
              <Chip key={i} value={asString(ch)}
                style={isPresent ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700 line-through"} />
            );
          })}
        </div>
      </div>
      {present.filter((ch) => !expected.includes(ch)).length > 0 && (
        <div>
          <SectionLabel>Additional chapters (bonus)</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {present.filter((ch) => !expected.includes(ch)).map((ch, i) => (
              <Chip key={i} value={asString(ch)} style="bg-brand-orange-light text-brand-orange-hover" />
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <KV label="Wrong template" value={log.wrong_template} />
        <KV label="Typology refinement" value={log.typology_refinement} />
        <KV label="Total penalties" value={`−${asString(log.total_penalties)} pts`} />
        <KV label="Total bonuses" value={`+${asString(log.total_bonuses)} pts`} />
      </div>
    </div>
  );
}

function P7Trace({ log }: { log: Record<string, unknown> }) {
  const ficTests = asRecord(log.fic_tests);
  const ficReasons = asRecord(log.fic_test_reasons);
  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Sparse-data protocol</SectionLabel>
        <div className="flex gap-2 flex-wrap">
          <Chip value={`Protocol: ${asString(log.sparse_data_protocol)}`} style="bg-gray-100 text-gray-700" />
          <Chip value={`${asString(log.claim_count)} load-bearing claims`} style="bg-gray-100 text-gray-700" />
        </div>
      </div>
      <div>
        <SectionLabel>Numerical Plausibility (NP)</SectionLabel>
        <div className="flex flex-wrap gap-2 text-xs mb-2">
          {[
            { label: "In-range + not-in-library", v: log.np_in_range },
            { label: "Boundary", v: log.np_boundary },
            { label: "OOR justified", v: log.np_oor_justified },
            { label: "Out-of-range", v: log.np_oor, red: true },
          ].map(({ label, v, red }) => (
            <div key={label} className={`rounded px-2 py-1 text-xs ${(red && asNum(v) !== null && asNum(v)! > 0) ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-600"}`}>
              <span className="font-semibold">{asString(v)}</span> {label}
            </div>
          ))}
        </div>
        <KV label="NP score" value={log.np_score} />
      </div>
      <div>
        <SectionLabel>Claim Calibration (CC)</SectionLabel>
        <KV label="Total CC penalties" value={log.cc_total_penalties} />
        <KV label="CC score" value={log.cc_score} />
      </div>
      <div>
        <SectionLabel>Financial Internal Consistency (FIC)</SectionLabel>
        <div className="space-y-2">
          {Object.entries(ficTests).map(([key, verdict]) => (
            <div key={key} className="rounded-lg border border-gray-100 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-medium text-gray-700 flex-1">{FIC_LABELS[key] ?? key}</span>
                <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${VERDICT_STYLES[asString(verdict)] ?? "bg-gray-100 text-gray-600"}`}>
                  {asString(verdict)}
                </span>
              </div>
              {ficReasons[key] != null && (
                <p className="text-xs text-gray-500 leading-relaxed">{asString(ficReasons[key])}</p>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2"><KV label="FIC score" value={log.fic_score} /></div>
      </div>
    </div>
  );
}

function GenericTrace({ log }: { log: Record<string, unknown> }) {
  const skip = new Set(["formula", "sparse_data_protocol"]);
  return (
    <div>
      {Object.entries(log)
        .filter(([k]) => !skip.has(k))
        .map(([k, v]) => {
          if (Array.isArray(v) && v.length > 0) {
            return (
              <div key={k} className="mb-2">
                <SectionLabel>{k.replace(/_/g, " ")}</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {v.map((item, i) => (
                    <Chip key={i} value={typeof item === "object" ? JSON.stringify(item) : asString(item)} />
                  ))}
                </div>
              </div>
            );
          }
          if (v && typeof v === "object" && !Array.isArray(v)) {
            return (
              <div key={k} className="mb-2">
                <SectionLabel>{k.replace(/_/g, " ")}</SectionLabel>
                {Object.entries(v as Record<string, unknown>).map(([ik, iv]) => (
                  <KV key={ik} label={ik.replace(/_/g, " ")} value={iv} />
                ))}
              </div>
            );
          }
          return <KV key={k} label={k.replace(/_/g, " ")} value={v} />;
        })}
    </div>
  );
}

// ─── P5 trace: internal vs external source split + jargon labels ─────────────

// Classify each provenance-type string as internal or external
const PROVENANCE_EXTERNAL = new Set([
  "market research", "independent analyst", "benchmark", "regulatory",
  "vendor-reported", "per market research", "per benchmark data",
  "analyst", "expert", "public records confirm", "public evidence verifies",
  "public records", "research", "industry", "government", "cited source",
]);

function classifyProvenance(type: string): "external" | "internal" {
  return PROVENANCE_EXTERNAL.has(type.toLowerCase().trim()) ? "external" : "internal";
}

function P5Trace({ log }: { log: Record<string, unknown> }) {
  const provTypes = asArr(log.provenance_types) as string[];
  const external = provTypes.filter((t) => classifyProvenance(t) === "external");
  const internal = provTypes.filter((t) => classifyProvenance(t) === "internal");
  const redFlags = asNum(log.red_flag_count) ?? 0;
  const premium = asNum(log.premium_count) ?? 0;
  const per100 = asNum(log.per_100_lines) ?? 0;
  const totalSources = asNum(log.total_sources) ?? 0;
  const tagCount = asNum(log.provenance_tag_count) ?? 0;
  const typeCount = asNum(log.provenance_type_count) ?? 0;

  return (
    <div className="space-y-4">
      {/* Citation density */}
      <div>
        <SectionLabel>Citation Density</SectionLabel>
        <p className="text-xs text-gray-500 mb-1">Citations per 100 lines of memo — higher = claims are backed by references more often.</p>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-semibold text-gray-800">{per100.toFixed(2)}/100 lines</span>
          <span className="text-xs text-gray-400">→ density score: {asNum(log.citation_density_score)}/5</span>
        </div>
      </div>

      {/* Source quality */}
      <div>
        <SectionLabel>Source Quality</SectionLabel>
        <p className="text-xs text-gray-500 mb-1.5">Credibility tier of sources cited. Capped at 3.0 if a red-flag low-quality domain appears.</p>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-gray-400 mb-0.5">Total sources</p>
            <p className="font-semibold text-gray-800">{totalSources}</p>
          </div>
          <div className="rounded-lg bg-green-50 px-3 py-2">
            <p className="text-green-600 mb-0.5">Premium (high-credibility)</p>
            <p className="font-semibold text-green-800">{premium}</p>
            <p className="text-green-500 text-xs">regulatory, research firms, filings</p>
          </div>
          <div className={`rounded-lg px-3 py-2 ${redFlags > 0 ? "bg-red-50" : "bg-gray-50"}`}>
            <p className={`mb-0.5 ${redFlags > 0 ? "text-red-600" : "text-gray-400"}`}>Red-flag sources</p>
            <p className={`font-semibold ${redFlags > 0 ? "text-red-800" : "text-gray-800"}`}>{redFlags}</p>
            <p className={`text-xs ${redFlags > 0 ? "text-red-500" : "text-gray-400"}`}>{redFlags > 0 ? "cap applied" : "none — no cap"}</p>
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-xs text-gray-500">Source quality score:</span>
          <span className="font-mono text-xs font-semibold">{asNum(log.source_quality_score)}/5</span>
        </div>
      </div>

      {/* Provenance tagging — internal vs external split */}
      <div>
        <SectionLabel>Provenance Tagging</SectionLabel>
        <p className="text-xs text-gray-500 mb-2">Origin labels in the memo text (e.g. &ldquo;Per market research,&rdquo; &ldquo;Mgmt estimate&rdquo;). Tag Count = total labels; Type Count = distinct kinds.</p>
        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-gray-400 mb-0.5">Provenance Tag Count</p>
            <p className="font-semibold text-gray-800">{tagCount} labels</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-gray-400 mb-0.5">Provenance Type Count</p>
            <p className="font-semibold text-gray-800">{typeCount} distinct kinds</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-1.5">Provenance tagging score: <span className="font-mono font-semibold">{asNum(log.provenance_tagging_score)}/5</span></p>

        {/* Internal vs External split */}
        {provTypes.length > 0 && (
          <div className="space-y-2">
            {external.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">External sources ({external.length} types)</p>
                <div className="flex flex-wrap gap-1">
                  {external.map((t, i) => (
                    <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded px-2 py-0.5">{t}</span>
                  ))}
                </div>
              </div>
            )}
            {internal.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Internal / client-stated ({internal.length} types)</p>
                <div className="flex flex-wrap gap-1">
                  {internal.map((t, i) => (
                    <span key={i} className="text-xs bg-amber-50 text-amber-700 border border-amber-100 rounded px-2 py-0.5">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── P8 trace: Move 8 explained ──────────────────────────────────────────────

function P8Trace({ log }: { log: Record<string, unknown> }) {
  const spec = asNum(log.specificity_score) ?? 0;
  const arch = asNum(log.decision_architecture_score) ?? 0;
  const integ = asNum(log.integration_score) ?? 0;
  const move8 = asNum(log.move8_score) ?? 0;
  const covi = asNum(log.covi) ?? 0;

  return (
    <div className="space-y-3">
      {[
        { label: "Specificity", val: spec, desc: "Is the recommendation concrete and quantified?" },
        { label: "Decision Architecture", val: arch, desc: "Does it have success gates and kill conditions?" },
        { label: "Integration", val: integ, desc: "Do the actions chain together with clear evidence links?" },
        {
          label: "Conviction Match (Move 8)",
          val: move8,
          desc: `Does the memo's confidence in its recommendation match how thoroughly it explored the question? ` +
            `Move 8 compares recommendation conviction against the Coverage score (P4 = ${covi > 0 ? covi.toFixed(2) : "—"}). ` +
            `A boldly confident recommendation on thin exploration is penalized; matched conviction earns full credit.`,
          highlight: true,
        },
      ].map(({ label, val, desc, highlight }) => (
        <div key={label} className={`rounded-lg border px-3 py-2.5 ${highlight ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-gray-50"}`}>
          <div className="flex items-center justify-between mb-0.5">
            <span className={`text-xs font-semibold ${highlight ? "text-amber-800" : "text-gray-600"}`}>{label}</span>
            <span className={`font-mono text-sm font-bold ${val >= 4 ? "text-green-700" : val >= 3 ? "text-amber-700" : "text-red-700"}`}>{val.toFixed(2)}</span>
          </div>
          <p className={`text-xs leading-relaxed ${highlight ? "text-amber-700" : "text-gray-500"}`}>{desc}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Critical Risks Addressed panel ──────────────────────────────────────────

const ADDRESSED_CONFIG: Record<string, { label: string; bg: string; dot: string; text: string }> = {
  ADDRESSED: { label: "Addressed",         bg: "bg-green-50 border-green-200",  dot: "bg-green-500", text: "text-green-800" },
  PARTIAL:   { label: "Partially Addressed",bg: "bg-amber-50 border-amber-200", dot: "bg-amber-400", text: "text-amber-800" },
  NOT_ADDRESSED: { label: "Not Addressed", bg: "bg-red-50 border-red-200",      dot: "bg-red-500",   text: "text-red-800"  },
};

function CriticalRisksPanel({ risks }: { risks: RiskRow[] }) {
  const critical = risks.filter((r) => r.severity === "CRITICAL" && r.approved);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-700">Critical Risks — Addressed in Memo?</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Informational check — does the memo address each confirmed critical risk?
          {" "}This does not affect scores (v1.5 suppressor is a separate feature).
        </p>
      </div>

      {critical.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-400 italic">
          No critical risks were confirmed for this run.
        </p>
      ) : (
        <div className="divide-y divide-gray-50">
          {critical.map((r) => {
            const cfg = r.addressedStatus
              ? ADDRESSED_CONFIG[r.addressedStatus]
              : null;
            return (
              <div key={r.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 font-medium">{r.statement}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.classification} · {r.source}
                    </p>
                  </div>
                  {cfg ? (
                    <span className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 border ${cfg.bg} ${cfg.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-gray-400 italic">Pending check</span>
                  )}
                </div>
                {r.addressedNote && (
                  <p className="mt-1.5 text-xs text-gray-500 leading-relaxed pl-0">
                    {r.addressedNote}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TraceabilityView({ ds }: { ds: DimensionScoreRow }) {
  const log = asRecord(ds.traceabilityLog);
  const formula = typeof log.formula === "string" ? log.formula : null;
  const p1Conflicts = (() => {
    const v = asRecord(ds.subScores).majorReconciliations;
    return typeof v === "number" ? v : null;
  })();

  return (
    <div className="space-y-4">
      {formula && (
        <div>
          <SectionLabel>Formula</SectionLabel>
          <code className="block text-xs bg-gray-100 rounded px-3 py-1.5 font-mono text-gray-700">{formula}</code>
        </div>
      )}
      {ds.dimensionKey === "P1" && <P1Trace log={log} conflictCount={p1Conflicts} findings={ds.findings ?? null} />}
      {ds.dimensionKey === "P3" && <P3Trace log={log} />}
      {ds.dimensionKey === "P5" && <P5Trace log={log} />}
      {ds.dimensionKey === "P7" && <P7Trace log={log} />}
      {ds.dimensionKey === "P8" && <P8Trace log={log} />}
      {!["P1", "P3", "P5", "P7", "P8"].includes(ds.dimensionKey) && <GenericTrace log={log} />}
    </div>
  );
}

// ─── Diagnostics strip ───────────────────────────────────────────────────────

function DiagnosticsStrip({ diagnostics }: { diagnostics: DiagRow[] }) {
  const [open, setOpen] = useState(false);
  const errors = diagnostics.filter((d) => d.type === "ERROR").length;
  const warnings = diagnostics.filter((d) => d.type === "CALIBRATION_WARNING").length;
  const allClear = diagnostics.length === 0;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors"
        aria-expanded={open}
      >
        <span className="text-xs font-medium text-gray-600">
          {allClear
            ? "Engine diagnostics: no issues — scores verified ✓"
            : `Engine diagnostics: ${errors} error${errors !== 1 ? "s" : ""}, ${warnings} calibration warning${warnings !== 1 ? "s" : ""} — click to expand`}
        </span>
        <svg className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-5 py-3 space-y-2">
          {allClear ? (
            <p className="text-xs text-gray-500">
              All 13 dimension scores were validated. Server-computed scores match agent classifications
              within acceptable drift tolerance (|drift| &lt; 1.0 for all dimensions).
            </p>
          ) : (
            diagnostics.map((d) => (
              <div key={d.id}
                className={`text-xs rounded-lg px-3 py-2 ${d.type === "ERROR" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
                <span className="font-semibold">{d.type === "ERROR" ? "Error" : "Calibration Warning"}</span>
                {" — "}
                {d.message}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Hero block ───────────────────────────────────────────────────────────────

/** Why a badge fired — mirrors statusBadge() in lib/confidence/index.ts.
 *  Reads the STORED Gap rows' severity (never re-derives from dimension scores, which
 *  would misread sentinel values) and, for the v1.1 Stage-2 floor, the stored D scores. */
function badgeHint(run: RunData): string | null {
  if (run.statusBadge === "MAJOR_REWORK") {
    if (run.memoConfidence < 50) return "Readiness below 50.";
    const highPillars = Array.from(
      new Set(run.gaps.filter((g) => g.severity === "HIGH").map((g) => g.dimensionKey))
    );
    if (highPillars.length > 0) return `Forced by ${highPillars.join(", ")} ≤ 2.0`;
    return null;
  }
  if (run.statusBadge === "NEEDS_WORK") {
    // V3 v1.1 Stage-2 floor: readiness qualified for READY_TO_SHIP and no HIGH
    // gap, but a D dimension at or below 2.0 held the badge back.
    const hasHighGap = run.gaps.some((g) => g.severity === "HIGH");
    if (run.memoConfidence >= 75 && !hasHighGap) {
      const floored = STAGE_2_KEYS.filter((k) => {
        const s = pillarScore(run, k);
        return s !== null && s <= 2.0;
      });
      if (floored.length > 0) return `Held at NEEDS_WORK by ${floored.join(", ")} ≤ 2.0`;
    }
    return null;
  }
  return null;
}

function HeroBlock({ run }: { run: RunData }) {
  const reworkHint = badgeHint(run);
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <div className="flex flex-wrap items-start gap-6">
        {/* Memo confidence — the ONE hero number */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Memo Readiness</p>
          <p className="text-6xl font-extrabold text-gray-900 leading-none">{run.memoConfidence.toFixed(1)}</p>
          <p className="text-xs text-gray-400 mt-1">out of 100</p>
          {run.scoredPillarCount !== null && run.scoredPillarCount < 8 && (
            <p className="text-xs text-amber-700 mt-1">
              Computed over {run.scoredPillarCount} of 8 pillars (not-scored pillars excluded via rescaling)
            </p>
          )}
          {run.scorableChapterCount !== null && (
            <p className="text-xs mt-2">
              <span className="text-gray-500">Scored on {run.scorableChapterCount} of 10 chapters</span>
              {run.scorableChapterCount < 10 && (
                <span className="ml-1.5 bg-amber-100 border border-amber-200 text-amber-700 rounded-full px-2 py-0.5 font-medium">
                  partial memo
                </span>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 mt-1">
          {/* Status badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`rounded-full px-4 py-1.5 text-sm font-semibold ${BADGE_STYLES[run.statusBadge] ?? ""}`}>
              {BADGE_LABELS[run.statusBadge] ?? run.statusBadge}
            </span>
            {reworkHint && (
              <span className="text-xs text-red-600 font-medium">{reworkHint}</span>
            )}
          </div>

          {/* Decision Confidence — quiet placeholder */}
          <div className="border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
            <p className="text-xs text-gray-500 font-medium">Decision Readiness</p>
            <p className="text-sm font-semibold text-gray-700">{run.decisionConfidence.toFixed(1)}</p>
            <p className="text-xs text-gray-400 italic">Same as Memo Readiness (Suppressor pending v1.5)</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stage matrix ─────────────────────────────────────────────────────────────

function StageMatrix({ run }: { run: RunData }) {
  const stageData = [
    { label: "Stage 1 — Solution Validity", keys: STAGE_1_KEYS, avg: run.stage1Avg },
    { label: "Stage 2 — Output Quality", keys: STAGE_2_KEYS, avg: run.stage2Avg },
  ];

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {stageData.map(({ label, keys, avg }) => (
        <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-bold ${scoreColor(avg)}`}>{avg.toFixed(2)}</p>
          </div>
          <div className="space-y-1">
            {keys.map((k) => {
              const score = pillarScore(run, k);
              const name = PILLAR_EXPLANATIONS[k]?.name ?? k;
              return (
                <div key={k}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400 w-7">{k}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${score === null ? "bg-gray-200" : score >= 4 ? "bg-green-400" : score >= 3 ? "bg-amber-400" : "bg-red-400"}`}
                        style={{ width: `${((score ?? 0) / 5) * 100}%` }}
                      />
                    </div>
                    <span className={`text-xs font-semibold text-right ${score === null ? "w-auto" : "w-8"} ${scoreColor(score)}`}>
                      {score !== null ? score.toFixed(1) : "Not scored"}
                    </span>
                    <span className="text-xs text-gray-500 hidden sm:block w-28 truncate">{name}</span>
                  </div>
                  {k === "P1" && (() => {
                    const conflicts = p1ConflictCount(run);
                    return (
                      <p className="text-[11px] text-gray-400 pl-9 mt-0.5">
                        Coherence conflicts: <span className={`font-semibold ${conflicts !== null && conflicts > 1 ? "text-red-600" : "text-gray-600"}`}>{conflicts ?? "—"}</span> — memos ship at ≤1
                      </p>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── ELO + version stamp ──────────────────────────────────────────────────────

function EloVersionCard({ run, onAddElo }: { run: RunData; onAddElo: () => void }) {
  const elo = run.memo.eloRecord;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-wrap gap-6 items-center">
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Rubric version</p>
        <p className="text-sm font-semibold text-gray-800">{run.rubricVersion}</p>
        <p className="text-xs text-gray-400">Run #{run.id} · {new Date(run.scoredAt).toLocaleDateString()}</p>
      </div>
      <div className="h-8 w-px bg-gray-200 hidden sm:block" />
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">ELO rating</p>
        {elo ? (
          <>
            <p className="text-sm font-semibold text-gray-800">{Math.round(elo.rating)}</p>
            <p className="text-xs text-gray-400">{elo.comparisonCount} comparison{elo.comparisonCount !== 1 ? "s" : ""}</p>
          </>
        ) : (
          <p className="text-sm text-gray-500 italic">Not yet rated</p>
        )}
        <button onClick={onAddElo}
          className="mt-1 text-xs text-brand-orange hover:text-brand-orange-hover underline">
          Add to ELO comparison
        </button>
      </div>
    </div>
  );
}

// ─── Chip strip ───────────────────────────────────────────────────────────────

function ChipStrip({ run, onChipClick }: { run: RunData; onChipClick: (key: string) => void }) {
  const allKeys = [...STAGE_1_KEYS, ...STAGE_2_KEYS];
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">13 Dimensions</p>
      <div className="flex flex-wrap gap-2">
        {allKeys.map((k) => {
          const score = pillarScore(run, k);
          return (
            <button key={k} onClick={() => onChipClick(k)}
              title={PILLAR_EXPLANATIONS[k]?.gloss}
              className={`border rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-brand-orange-ring ${chipStyle(score)}`}>
              <span className="font-bold">{k}</span>
              <span>{score !== null ? score.toFixed(2) : "Not scored"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tab: Gaps ────────────────────────────────────────────────────────────────

// ─── Client-side traceability enrichment ─────────────────────────────────────
// When the DB gap text is the old generic pattern ("below threshold / review the
// traceability log"), replace it with the traceabilityLog-derived specific text.
// This works for both old runs (immediate) and future runs (redundant but harmless).

const GENERIC_GAP_PATTERN = /below threshold|review.*traceability/i;

function enrichGapFromTrace(
  g: GapRow,
  dimensionScores: DimensionScoreRow[]
): GapRow {
  if (!GENERIC_GAP_PATTERN.test(g.issue) && !GENERIC_GAP_PATTERN.test(g.fix)) {
    return g; // already specific — use as-is
  }
  const ds = dimensionScores.find((d) => d.dimensionKey === g.dimensionKey);
  if (!ds) return g;

  // Derive specific text from traceabilityLog (mirrors pipeline logic)
  const specific = deriveGapFromTrace(ds);
  if (!specific) return g;
  return { ...g, issue: specific.issue, impact: specific.impact, fix: specific.fix };
}

function deriveGapFromTrace(
  ds: DimensionScoreRow
): { issue: string; impact: string; fix: string } | null {
  // NOT_SCORED produces no gap — a null score is missing data, not a deficiency
  if (ds.serverComputed === null) return null;
  const log = ds.traceabilityLog;
  const sub = asRecord(ds.subScores);
  const score = ds.serverComputed;
  const erosionPts = ((5 - score) * 2.5).toFixed(1);
  const impact = `Readiness erosion: ${erosionPts} points.`;
  const key = ds.dimensionKey;

  const asNum = (v: unknown) =>
    typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) || 0 : 0;

  switch (key) {
    case "P1": {
      const flat = asNum(log.flat_contradictions);
      const major = asNum(log.major_reconciliation_failures);
      const reasoning = asNum(log.reasoning_gaps);
      const minor = asNum(log.minor_gaps);
      const capApplied = log.minor_cap_applied === true;
      if (flat > 0) return { issue: `Coherence: ${flat} flat contradiction(s) between memo sections.`, impact, fix: `Locate and resolve the contradictory statements. Where two values for the same metric differ, pick one and label any intentional range explicitly.` };
      if (major > 0) return { issue: `Coherence: ${major} major reconciliation failure(s) — same metric, conflicting values across sections.`, impact, fix: `Reconcile the conflicting figures. Unify the value or explicitly label one as a scenario variant.` };
      if (reasoning > 0) return { issue: `Coherence: ${reasoning} reasoning gap(s) where conclusions don't follow from stated evidence.${capApplied ? " (Minor-category cap applied.)" : ""}`, impact, fix: `Add explicit logical bridges between evidence and conclusions. Each key conclusion should cite the supporting evidence step.` };
      return { issue: `Coherence: ${minor} minor reconciliation inconsistency/ies.${capApplied ? " (Cap applied.)" : ""}`, impact, fix: `Review the P1 Breakdown findings and align the conflicting expressions.` };
    }
    case "P7": {
      const ficTests = asRecord(log.fic_tests);
      const ficReasons = asRecord(log.fic_test_reasons);
      const failed = Object.entries(ficTests).filter(([, v]) => v === "FAIL");
      const npOor = asNum(log.np_oor);
      const ccPen = asNum(log.cc_total_penalties);
      if (failed.length > 0) {
        const details = failed.map(([k]) => `${FIC_LABELS[k] ?? k}: ${asString(ficReasons[k]).slice(0, 300)}`).join(" | ");
        return { issue: `Output Realism — Failed FIC test(s): ${details}`, impact, fix: `Reconcile the internal contradiction above. Name the specific figures that conflict and resolve them.` };
      }
      if (npOor > 0) return { issue: `Output Realism: ${npOor} financial claim(s) classified out-of-range vs benchmark library.`, impact, fix: `Revise the out-of-range figures to plausible ranges, or add an explicit justification (J1 = cited primary source, J2 = named analyst source, J3 = stated business rationale).` };
      if (ccPen > 0) return { issue: `Output Realism: ${ccPen.toFixed(1)} claim-calibration penalty point(s) — definitive language on weakly-evidenced claims.`, impact, fix: `Soften definitive claims lacking Tier-1/Tier-2 evidence. Use "projected," "estimated," or "targeted."` };
      return null;
    }
    case "P3": {
      const missing = asArr(log.missing_chapters) as string[];
      const wrongTemplate = log.wrong_template === true;
      const typology = asString(log.typology);
      if (wrongTemplate) return { issue: `Structural Accuracy: Wrong template for typology ${typology}. Missing: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ` +${missing.length - 3} more` : ""}.`, impact, fix: `Restructure to the required chapter list for typology ${typology}.` };
      if (missing.length > 0) return { issue: `Structural Accuracy: ${missing.length} required chapter(s) absent: ${missing.join(", ")}.`, impact, fix: `Add the missing chapters with their required sub-sections.` };
      return null;
    }
    case "P2": {
      const fid = asNum(sub.fidelityScore ?? log.fidelity_score);
      const gap2 = asNum(sub.gapFillingScore ?? log.gap_filling_score);
      const exec = asNum(sub.executabilityScore ?? log.executability_score);
      const mn = Math.min(fid, gap2, exec);
      if (fid === mn) return { issue: `Problem Formulation: Fidelity low (${fid.toFixed(2)}/5) — may be answering a nearby question, not the framing's exact decision.`, impact, fix: `Re-read the framing's Core Question. Ensure the recommendation directly answers it and each blocking question has a memo section.` };
      if (gap2 === mn) return { issue: `Problem Formulation: Gap-filling low (${gap2.toFixed(2)}/5) — some blocking questions unanswered.`, impact, fix: `Add dedicated sections for each framing blocking question not yet addressed.` };
      return { issue: `Problem Formulation: Executability low (${exec.toFixed(2)}/5) — actions lack measurable gates.`, impact, fix: `For each recommended action add a success criterion, a kill condition, and a time-bound deadline.` };
    }
    case "P4": {
      const opts = asNum(sub.optionsScore ?? log.options_score);
      const scen = asNum(sub.scenariosScore ?? log.scenarios_score);
      const sens2 = asNum(sub.sensitivitiesScore ?? log.sensitivities_score);
      const ia = asNum(sub.iaScore ?? log.ia_score);
      const mn = Math.min(opts, scen, sens2, ia);
      const nm = mn === opts ? "options" : mn === scen ? "scenarios" : mn === sens2 ? "sensitivities" : "interpretive alternatives";
      const fix = nm === "options" ? "Add a distinct alternative with a head-to-head comparison." : nm === "scenarios" ? "Add best/worst/base scenarios with quantified outcome ranges." : nm === "sensitivities" ? "Add a sensitivity test showing how the recommendation changes under different assumptions." : "Add explicit counterarguments and address each one.";
      return { issue: `Coverage: "${nm}" sub-dimension weakest (${mn.toFixed(2)}/5) — decision space underexplored.`, impact, fix };
    }
    case "P5": {
      const ciSc = asNum(sub.citationDensityScore ?? log.citation_density_score);
      const sqSc = asNum(sub.sourceQualityScore ?? log.source_quality_score);
      const ptSc = asNum(sub.provenanceTaggingScore ?? log.provenance_tagging_score);
      const rf = asNum(log.red_flag_count);
      const p100 = asNum(log.per_100_lines);
      if (rf > 0) return { issue: `Evidence Quality: ${rf} red-flag domain(s) — source quality capped at 3.0.`, impact, fix: `Replace red-flag sources with Tier-1 (filed docs, primary data) or Tier-2 (named analyst reports).` };
      if (ciSc <= 2) return { issue: `Evidence Quality: Citation density low (${p100.toFixed(1)}/100 lines) — many claims lack sources.`, impact, fix: `Add citations to load-bearing claims. Target ≥6/100 lines. Prioritise financial projections and market size claims.` };
      if (ptSc <= 2) return { issue: `Evidence Quality: Provenance tagging weak (${ptSc.toFixed(2)}/5) — figures not traceable to origin.`, impact, fix: `Tag every figure with its source type (Client, Platform, External).` };
      return { issue: `Evidence Quality: EQI ${score.toFixed(2)}/5 (density: ${ciSc.toFixed(2)}, quality: ${sqSc.toFixed(2)}, provenance: ${ptSc.toFixed(2)}).`, impact, fix: `Address the lowest sub-score (see Breakdown tab for counts).` };
    }
    case "P6": {
      const idSc = asNum(sub.identificationScore ?? log.identification_score);
      const atSc = asNum(sub.attributionScore ?? log.attribution_score);
      const snSc = asNum(sub.sensitivityAwarenessScore ?? log.sensitivity_awareness_score);
      const mn = Math.min(idSc, atSc, snSc);
      if (idSc === mn) return { issue: `Assumption Quality: No dedicated Assumptions section (identification ${idSc.toFixed(2)}/5).`, impact, fix: `Add an Assumptions section. List all material assumptions tagged as Client-provided or Platform-derived.` };
      if (atSc === mn) return { issue: `Assumption Quality: Assumptions lack source attribution (${atSc.toFixed(2)}/5).`, impact, fix: `Tag each assumption with "(Client)" for client-stated inputs, or a named source for platform-derived figures.` };
      return { issue: `Assumption Quality: Assumptions not linked to validation thresholds (${snSc.toFixed(2)}/5).`, impact, fix: `For each high-impact assumption, add the specific threshold that would change the recommendation.` };
    }
    case "P8": {
      const spSc = asNum(sub.specificityScore ?? log.specificity_score);
      const arSc = asNum(sub.decisionArchitectureScore ?? log.decision_architecture_score);
      const inSc = asNum(sub.integrationScore ?? log.integration_score);
      const m8 = asNum(sub.move8Score ?? log.move8_score);
      const mn = Math.min(spSc, arSc, inSc, m8);
      if (m8 === mn || m8 < 3) return { issue: `Solution Quality: Move 8 (conviction calibration) low (${m8.toFixed(2)}/5) — conviction doesn't match analysis breadth.`, impact, fix: `Either strengthen Coverage to justify current conviction, or temper recommendation language to match analysis depth.` };
      if (arSc === mn) return { issue: `Solution Quality: Decision architecture weak (${arSc.toFixed(2)}/5) — actions lack gates/kill conditions.`, impact, fix: `For each action: add a success gate, a kill condition, and a named decision owner.` };
      if (spSc === mn) return { issue: `Solution Quality: Recommendation specificity low (${spSc.toFixed(2)}/5) — lacks quantification or named entities.`, impact, fix: `Specify the dollar amount, the named entity (vendor/partner/product), and the exact approval decision.` };
      return { issue: `Solution Quality: Integration low (${inSc.toFixed(2)}/5) — actions lack Q/A/Basis links.`, impact, fix: `For each recommendation, add an explicit link from the finding that drives it.` };
    }
    default:
      return null;
  }
}

function GapsTab({ gaps, dimensionScores }: { gaps: GapRow[]; dimensionScores: DimensionScoreRow[] }) {
  // Build gaps from traceabilityLog for any pillar not in DB gaps list
  // (covers low-scoring pillars that might have been missed by old pipeline)
  const EDIT_THRESHOLD = 4.0;
  const tracyGaps: GapRow[] = dimensionScores
    .filter(
      (ds) =>
        ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"].includes(ds.dimensionKey) &&
        // explicit null guard: NOT_SCORED must never synthesize a gap
        // (JS would coerce null < 4 to true and null <= 2 to HIGH severity)
        ds.serverComputed !== null &&
        ds.serverComputed < EDIT_THRESHOLD &&
        !gaps.some((g) => g.dimensionKey === ds.dimensionKey)
    )
    .map((ds) => {
      const specific = deriveGapFromTrace(ds);
      if (!specific) return null;
      return {
        id: -ds.id, // synthetic id — negative to avoid collision
        dimensionKey: ds.dimensionKey,
        issue: specific.issue,
        impact: specific.impact,
        fix: specific.fix,
        severity: ds.serverComputed !== null && ds.serverComputed <= 2 ? "HIGH" : "MEDIUM",
      } as GapRow;
    })
    .filter(Boolean) as GapRow[];

  // Enrich DB gaps that are still generic, merge with trace-derived ones
  const enriched = gaps.map((g) => enrichGapFromTrace(g, dimensionScores));
  const allGaps = [...enriched, ...tracyGaps].sort((a, b) => {
    const sevOrd: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return (sevOrd[a.severity] ?? 9) - (sevOrd[b.severity] ?? 9);
  });

  if (allGaps.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">
        No gaps recorded for this run — all Stage 1 pillars scored above threshold.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {allGaps.map((g) => (
        <div key={g.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 border ${SEV_STYLES[g.severity] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                {g.severity}
              </span>
              <span className="text-xs text-gray-400 font-mono">{g.dimensionKey}</span>
              <span className="text-xs text-gray-500">{PILLAR_EXPLANATIONS[g.dimensionKey]?.name}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Issue</p>
              <p className="text-sm text-gray-800">{g.issue}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Impact</p>
              <p className="text-sm text-gray-600">{g.impact}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Fix</p>
              <p className="text-sm text-gray-600">{g.fix}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Edits ───────────────────────────────────────────────────────────────

function EditsTab({ edits }: { edits: EditRow[] }) {
  const [copied, setCopied] = useState<number | null>(null);

  function copy(id: number, text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  if (edits.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">
        No Edit suggestions recorded for this run.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {edits.map((e) => {
        const fullText = `Issue: ${e.issue}\n\nImpact: ${e.impact}\n\nFix: ${e.fix}`;
        return (
          <div key={e.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 border ${SEV_STYLES[e.severity] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                  {e.severity}
                </span>
                <span className="text-xs text-gray-400 font-mono">{e.dimensionKey}</span>
                <span className="text-xs text-gray-500">{PILLAR_EXPLANATIONS[e.dimensionKey]?.name}</span>
              </div>
              <button onClick={() => copy(e.id, fullText)}
                className="shrink-0 text-xs text-gray-400 hover:text-brand-orange transition-colors px-2 py-1 rounded border border-gray-200 hover:border-brand-orange-ring">
                {copied === e.id ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Issue</p>
                <p className="text-sm text-gray-800">{e.issue}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Impact</p>
                <p className="text-sm text-gray-600">{e.impact}</p>
              </div>
              <div className="bg-brand-orange-light border border-brand-orange-ring rounded-lg p-3">
                <p className="text-xs font-semibold text-brand-orange-hover uppercase tracking-wider mb-0.5">Suggested edit</p>
                <p className="text-sm text-brand-orange">{e.fix}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab: Breakdown ───────────────────────────────────────────────────────────

function BreakdownRow({ ds, defaultOpen = false }: { ds: DimensionScoreRow; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const exp = PILLAR_EXPLANATIONS[ds.dimensionKey];
  const guide = PILLAR_GUIDE_DETAILS[ds.dimensionKey];
  const score = ds.serverComputed;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        aria-expanded={open}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 font-mono text-xs bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded">
            {ds.dimensionKey}
          </span>
          <span className="font-semibold text-sm text-gray-900 truncate">{exp?.name}</span>
          <span className="hidden sm:inline text-xs text-gray-400">{exp?.stage}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`${score !== null ? "text-xl" : "text-sm"} font-bold ${scoreColor(score)}`}>
            {score !== null ? score.toFixed(2) : "Not scored"}
          </span>
          <svg className={`h-4 w-4 transition-transform ${open ? "rotate-180 text-brand-orange" : "text-gray-400"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-5 space-y-5">
          {/* Layer 1: What it measures */}
          <div>
            <SectionLabel>What it measures</SectionLabel>
            <p className="text-xs text-gray-500 leading-relaxed mb-2">{exp?.detail}</p>
            {guide && (
              <>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <code className="text-xs bg-gray-100 rounded px-2 py-1 font-mono text-gray-700">{guide.formula}</code>
                  <span className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-500">{guide.mathType}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed mb-2">{guide.formulaPlain}</p>
                <ul className="space-y-0.5">
                  {guide.measures.map((m, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-500">
                      <span className="mt-1.5 shrink-0 w-1 h-1 rounded-full bg-gray-300" />
                      {m}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Layer 2: This run's sub-scores */}
          <div>
            <SectionLabel>This run — sub-scores</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {Object.entries(asRecord(ds.subScores)).map(([k, v]) => {
                if (typeof v !== "number") return null;
                return (
                  <div key={k} className="text-xs rounded-lg border border-gray-100 px-3 py-1.5 bg-gray-50">
                    <span className="text-gray-500">{k.replace(/([A-Z])/g, " $1").trim()}: </span>
                    <span className="font-semibold font-mono text-gray-800">{v.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
            {ds.calibrationDrift && (
              <p className="mt-2 text-xs bg-amber-50 text-amber-700 rounded px-3 py-1.5 border border-amber-200">
                ⚠ Calibration drift: server={score?.toFixed(2) ?? "Not scored"}, agent={ds.agentSelfReported?.toFixed(2) ?? "—"}
              </p>
            )}
          </div>

          {/* Layer 3: Traceability findings */}
          <div>
            <SectionLabel>Traceability findings</SectionLabel>
            <TraceabilityView ds={ds} />
          </div>

          {/* Score meaning for this score */}
          {guide && score !== null && (
            <div>
              <SectionLabel>What this score means</SectionLabel>
              {(() => {
                const rounded = Math.round(score) as 1 | 2 | 3 | 4 | 5;
                const meaning = guide.scoreMeanings.find((m) => m.score === rounded);
                return meaning ? (
                  <p className="text-xs text-gray-600 leading-relaxed">
                    <span className={`font-bold mr-1.5 ${scoreColor(score)}`}>{score.toFixed(2)}</span>
                    {meaning.means}
                  </p>
                ) : null;
              })()}
            </div>
          )}
          {guide && score === null && (
            <div>
              <SectionLabel>What this score means</SectionLabel>
              <p className="text-xs text-gray-500 leading-relaxed">
                <span className="font-bold mr-1.5 text-gray-400">Not scored</span>
                {ds.dimensionKey === "P7"
                  ? "P7: Not scored — insufficient financial claims (excluded from readiness)."
                  : "This dimension was not scored on this run (insufficient input data) and is excluded from readiness."}{" "}
                Under V3 v1.1, readiness is rescaled over the scored pillars so an unscored
                pillar neither erodes nor inflates the score.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BreakdownTab({ run, focusKey }: { run: RunData; focusKey: string | null }) {
  const ordered = [
    ...STAGE_1_KEYS.map((k) => run.dimensionScores.find((d) => d.dimensionKey === k)),
    ...STAGE_2_KEYS.map((k) => run.dimensionScores.find((d) => d.dimensionKey === k)),
  ].filter(Boolean) as DimensionScoreRow[];

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Stage 1 — Solution Validity</p>
        {STAGE_1_KEYS.map((k) => {
          const ds = run.dimensionScores.find((d) => d.dimensionKey === k);
          if (!ds) return null;
          return <BreakdownRow key={k} ds={ds} defaultOpen={focusKey === k} />;
        })}
      </div>
      <div className="space-y-2 pt-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Stage 2 — Output Quality</p>
        {STAGE_2_KEYS.map((k) => {
          const ds = run.dimensionScores.find((d) => d.dimensionKey === k);
          if (!ds) return null;
          return <BreakdownRow key={k} ds={ds} defaultOpen={focusKey === k} />;
        })}
      </div>
    </div>
  );
}

// ─── Tab: Explanation ─────────────────────────────────────────────────────────

function ExplanationTab({ run }: { run: RunData }) {
  const summary = generateExplanation(run);
  const topErosion = STAGE_1_KEYS.flatMap((k) => {
    const score = pillarScore(run, k);
    if (score === null) return []; // not scored — no erosion attributed
    const e = erosion(score);
    return [{ key: k, name: PILLAR_EXPLANATIONS[k]?.name ?? k, score, erosion: e }];
  })
    .filter((p) => p.erosion > 0)
    .sort((a, b) => b.erosion - a.erosion);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Score narrative</p>
        <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
      </div>

      {topErosion.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Stage 1 erosion sources (ranked)</p>
          <div className="space-y-2">
            {topErosion.map(({ key, name, score: s, erosion: e }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="font-mono text-xs text-gray-400 w-8">{key}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-gray-700">{name}</span>
                    <span className="text-xs font-mono text-red-600">−{e.toFixed(1)} pts</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full"
                      style={{ width: `${(e / 10) * 100}%` }} />
                  </div>
                </div>
                <span className={`text-xs font-semibold font-mono w-10 text-right ${scoreColor(s)}`}>{s.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Stage 2 presentation profile</p>
        <div className="space-y-2">
          {STAGE_2_KEYS.map((k) => {
            const s = pillarScore(run, k);
            const name = PILLAR_EXPLANATIONS[k]?.name ?? k;
            return (
              <div key={k} className="flex items-center gap-3">
                <span className="font-mono text-xs text-gray-400 w-8">{k}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-gray-700">{name}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${s === null ? "bg-gray-200" : s >= 4 ? "bg-green-400" : s >= 3 ? "bg-amber-400" : "bg-red-400"}`}
                      style={{ width: `${((s ?? 0) / 5) * 100}%` }} />
                  </div>
                </div>
                <span className={`text-xs font-semibold font-mono text-right ${s === null ? "w-auto" : "w-10"} ${scoreColor(s)}`}>
                  {s !== null ? s.toFixed(2) : "Not scored"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Recovery ────────────────────────────────────────────────────────────

function RecoveryTab({
  run,
  gaps,
}: {
  run: RunData;
  gaps: GapRow[];
}) {
  const items = computeRecovery(run);

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">
        All Stage 1 pillars are at maximum score — no recovery headroom.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
        <strong>Indicative ranking only.</strong> Readiness gain assumes a pillar reaches score 5.
        Each figure is (5 − current) × 2.5 per the erosion formula.
      </div>

      {items.map(({ key, name, gloss, score: s, headroom, gain }) => {
        // Get the specific finding from traceabilityLog for this pillar
        const ds = run.dimensionScores.find((d) => d.dimensionKey === key);
        const traceGap = ds ? deriveGapFromTrace(ds) : null;

        // Also show any DB gaps for this pillar (enriched)
        const relatedGaps = gaps
          .filter((g) => g.dimensionKey === key)
          .map((g) => enrichGapFromTrace(g, run.dimensionScores));

        const editSuggestion = run.edits?.find((e) => e.dimensionKey === key);

        return (
          <div key={key} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-400">{key}</span>
                  <span className="text-sm font-semibold text-gray-900">{name}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{gloss}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-400">Current</p>
                <p className={`text-xl font-bold ${scoreColor(s)}`}>{s.toFixed(2)}</p>
                <p className="text-xs text-gray-400">/ 5</p>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${s >= 4 ? "bg-green-400" : s >= 3 ? "bg-amber-400" : "bg-red-400"}`}
                  style={{ width: `${(s / 5) * 100}%` }}
                />
              </div>
              <div className="text-right shrink-0">
                <span className="text-sm font-bold text-green-700">+{gain.toFixed(1)} pts</span>
                <span className="text-xs text-gray-400 ml-1">potential gain</span>
              </div>
            </div>

            {/* Specific finding from traceabilityLog */}
            {traceGap && (
              <div className="mb-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Specific finding</p>
                <p className="text-xs text-gray-700">{traceGap.issue}</p>
                <p className="text-xs text-gray-500 mt-1">
                  <span className="font-medium">Action: </span>{traceGap.fix}
                </p>
              </div>
            )}

            {/* Matching edit suggestion if one was generated */}
            {editSuggestion && (
              <div className="mb-3 rounded-lg border border-brand-orange-ring bg-brand-orange-light px-3 py-2.5">
                <p className="text-xs font-semibold text-brand-orange-hover uppercase tracking-wider mb-1">Concrete Edit</p>
                <p className="text-xs text-gray-700">{editSuggestion.issue}</p>
                <p className="text-xs text-brand-orange mt-1.5 font-medium">{editSuggestion.fix}</p>
              </div>
            )}

            {/* Fallback: DB gaps (enriched) if no trace gap */}
            {!traceGap && relatedGaps.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Related Gaps</p>
                <div className="space-y-1.5">
                  {relatedGaps.map((g) => (
                    <div
                      key={g.id}
                      className={`text-xs rounded-lg px-3 py-2 border ${SEV_STYLES[g.severity] ?? "bg-gray-50 border-gray-200 text-gray-600"}`}
                    >
                      <span className="font-semibold">{g.severity}:</span> {g.issue}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Redundancy (Five Favorite Friends) tab ──────────────────────────────────

interface FavoriteFriend {
  rank: number;
  label: string;
  assertionCount: number;
  chapterSpread: number;
  chapters: string[];
  instances: Array<{ chapter: string; text: string }>;
}

function SRIGauge({ sri }: { sri: number }) {
  // Color: green ≤0.2, amber 0.2–0.4, red >0.4
  const color = sri <= 0.2 ? "text-green-700" : sri <= 0.4 ? "text-amber-700" : "text-red-600";
  const bar = sri <= 0.2 ? "bg-green-400" : sri <= 0.4 ? "bg-amber-400" : "bg-red-500";
  const label = sri <= 0.15 ? "Low" : sri <= 0.3 ? "Moderate" : sri <= 0.45 ? "High" : "Very High";
  return (
    <div className="flex items-end gap-4">
      <div>
        <p className={`text-5xl font-extrabold leading-none ${color}`}>{(sri * 100).toFixed(1)}%</p>
        <p className={`text-sm font-semibold mt-1 ${color}`}>{label} self-repetition</p>
      </div>
      <div className="flex-1 pb-2">
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${Math.min(sri * 100, 100)}%` }} />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>0% (ideal)</span><span>50%+</span>
        </div>
      </div>
    </div>
  );
}

function FavoriteFriendRow({ ff }: { ff: FavoriteFriend }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        aria-expanded={open}>
        <div className="flex items-start gap-3 min-w-0">
          <span className="shrink-0 w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center mt-0.5">
            {ff.rank}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">{ff.label}</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {ff.chapters.map((ch) => (
                <span key={ch} className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{ch}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-base font-bold text-red-600">{ff.assertionCount}×</p>
            <p className="text-xs text-gray-400">{ff.chapterSpread} chapter{ff.chapterSpread !== 1 ? "s" : ""}</p>
          </div>
          <svg className={`h-4 w-4 transition-transform ${open ? "rotate-180 text-brand-orange" : "text-gray-400"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {ff.instances.map((inst, i) => (
            <div key={i} className="px-4 py-2.5">
              <p className="text-xs font-semibold text-gray-400 mb-0.5">{inst.chapter}</p>
              <p className="text-xs text-gray-700 leading-relaxed">{inst.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** How many repeated clusters render expanded before the long tail collapses (display-only). */
const REPEATED_CLAIMS_VISIBLE = 8;

function RepeatedClaimsList({ favorites }: { favorites: FavoriteFriend[] }) {
  const [showAll, setShowAll] = useState(false);
  const hasOverflow = favorites.length > REPEATED_CLAIMS_VISIBLE;
  const visible = showAll || !hasOverflow ? favorites : favorites.slice(0, REPEATED_CLAIMS_VISIBLE);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Repeated Claims ({favorites.length})
        </p>
        <p className="text-xs text-gray-400">All claims asserted more than once, by re-assertion count — expand each to see instances</p>
      </div>
      <div className="space-y-2">
        {favorites.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-6">No claims were repeated across chapters.</p>
        ) : (
          visible.map((ff) => <FavoriteFriendRow key={ff.rank} ff={ff} />)
        )}
      </div>
      {hasOverflow && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 w-full text-xs font-semibold text-brand-orange hover:text-brand-orange-hover border border-dashed border-gray-300 rounded-xl py-2 transition-colors">
          {showAll
            ? "Collapse to top 8"
            : `Show all ${favorites.length} repeated claims`}
        </button>
      )}
    </div>
  );
}

function RedundancyTab({ redundancy }: { redundancy: RunData["redundancyAnalysis"] }) {
  if (!redundancy) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-gray-400 italic">Redundancy analysis not available for this run.</p>
        <p className="text-xs text-gray-400 mt-1">Re-score the memo to generate the analysis.</p>
      </div>
    );
  }

  if (redundancy.analysisStatus === "failed") {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-amber-700">Redundancy analysis encountered an error.</p>
        {redundancy.errorMessage && (
          <p className="text-xs text-gray-400 mt-1 font-mono">{redundancy.errorMessage}</p>
        )}
        <p className="text-xs text-gray-400 mt-2">Scoring was unaffected. Re-score to retry.</p>
      </div>
    );
  }

  if (redundancy.analysisStatus === "skipped" || redundancy.claimCount === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-gray-400 italic">No claims extracted — redundancy analysis skipped.</p>
      </div>
    );
  }

  const rawFavorites = redundancy.favoriteFriends;
  const favorites: FavoriteFriend[] = Array.isArray(rawFavorites)
    ? (rawFavorites as FavoriteFriend[])
    : [];
  const sri = redundancy.sri;
  const isClean = sri <= 0.15 && favorites.filter((f) => f.assertionCount > 2).length === 0;
  // Restated instances = total claims − unique ideas (each cluster of size k contributes k−1)
  const restatedInstances = redundancy.claimCount - redundancy.uniqueClusterCount;

  return (
    <div className="space-y-6">
      {/* ── Headline ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Self-Repetition Index</p>
        <SRIGauge sri={sri} />
        <p className="text-xs text-gray-500 mt-3 leading-relaxed">
          {(sri * 100).toFixed(1)}% of the memo&apos;s claims are restatements of claims already made
          ({redundancy.claimCount} total · {redundancy.uniqueClusterCount} unique ideas).
          {favorites.length > 0 ? (
            <>
              {" "}<strong className="text-gray-700">{favorites.length} idea{favorites.length !== 1 ? "s are" : " is"} repeated</strong>,
              accounting for <strong className="text-gray-700">{restatedInstances} restated instance{restatedInstances !== 1 ? "s" : ""}</strong>.
            </>
          ) : ""}
        </p>
      </div>

      {/* ── Favorite Friends ── */}
      {isClean ? (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-6 text-center">
          <p className="text-sm font-semibold text-green-800">✓ No significant self-repetition detected</p>
          <p className="text-xs text-green-700 mt-1">Claims are largely stated once. This memo communicates efficiently.</p>
        </div>
      ) : (
        <RepeatedClaimsList favorites={favorites} />
      )}

      {/* ── Per-chapter info gain ── */}
      {(() => {
        const pcg = redundancy.perChapterGain as Record<string, number> | null;
        if (!pcg || Object.keys(pcg).length === 0) return null;
        return (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Chapter Information Gain
            </p>
            <p className="text-xs text-gray-500 mb-3">
              What fraction of each chapter&apos;s claims are NEW relative to earlier chapters (100% = fully novel; lower = mostly restatement).
            </p>
            <div className="space-y-1.5">
              {Object.entries(pcg).map(([ch, gain]) => (
                <div key={ch} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-48 truncate shrink-0">{ch}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${gain >= 0.7 ? "bg-green-400" : gain >= 0.4 ? "bg-amber-400" : "bg-red-400"}`}
                      style={{ width: `${Math.round(gain * 100)}%` }}
                    />
                  </div>
                  <span className={`text-xs font-mono shrink-0 w-10 text-right ${gain >= 0.7 ? "text-green-700" : gain >= 0.4 ? "text-amber-700" : "text-red-600"}`}>
                    {Math.round(gain * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── What it measures ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">What this measures</p>
        <div className="space-y-3 text-xs text-gray-600 leading-relaxed">
          <p>
            <strong className="text-gray-700">Five Favorite Friends</strong> is the pattern where a generator picks ~5 claims
            (e.g. &ldquo;$25M ARR target,&rdquo; &ldquo;9–12 month sales cycle,&rdquo; &ldquo;45% gross margin&rdquo;) and
            re-asserts them — reworded — across many chapters. This is semantic repetition, distinct from token-loop
            degeneration. Because the restatements are reworded, it must be detected by meaning (embeddings),
            not by matching words.
          </p>
          <p>
            <strong className="text-gray-700">Self-Repetition Index (SRI)</strong> = 1 − (unique semantic clusters ÷ total claim instances).
            SRI of 0 means every claim is stated exactly once. SRI of 0.5 means half the claims are restatements.
          </p>
          <p>
            <strong className="text-gray-700">How it&apos;s computed:</strong> atomic claims are extracted from each scored chapter,
            embedded via <code className="font-mono bg-gray-100 px-1 rounded">text-embedding-3-small</code>, then
            clustered by cosine similarity (threshold: {(redundancy.threshold * 100).toFixed(0)}%).
            Two claims in the same cluster are semantically equivalent restatements.
          </p>
          <p className="text-gray-400 italic">
            Diagnostic only — this does not affect Memo Readiness, the 13 dimension scores, or the status badge.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── ELO comparison modal ────────────────────────────────────────────────────

interface EloMemoOption {
  memoId: number;
  name: string;
  typology: string;
  rating: number;
  latestRunId: number | null;
}

function EloComparisonModal({
  currentMemoId,
  currentMemoName,
  onClose,
}: {
  currentMemoId: number;
  currentMemoName: string;
  onClose: () => void;
}) {
  const [memos, setMemos] = useState<EloMemoOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [opponentId, setOpponentId] = useState<number | "">("");
  const [winner, setWinner] = useState<"A" | "B" | "TIE">("A");
  const [margin, setMargin] = useState<"CLEAR" | "MODERATE" | "SLIGHT" | "AMBIGUOUS">("MODERATE");
  const [confidence, setConfidence] = useState<"HIGH" | "MEDIUM" | "LOW">("MEDIUM");
  const [reasoning, setReasoning] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ratingA: number; ratingB: number } | null>(null);
  const [error, setError] = useState("");

  // Load available memos on first render (client only — useEffect equivalent via useState initialiser)
  const [_fetched] = useState(() => {
    if (typeof window !== "undefined") {
      fetch("/api/elo/memos")
        .then((r) => r.json())
        .then((data: EloMemoOption[]) => {
          setMemos(data.filter((m) => m.memoId !== currentMemoId));
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
    return true;
  });

  async function submit() {
    if (!opponentId) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/elo/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memoAId: currentMemoId,
          memoBId: opponentId,
          winner,
          margin,
          confidence,
          reasoning: reasoning.trim() || undefined,
          humanOverride: true,
        }),
      });
      const data = (await res.json()) as { ratingA?: number; ratingB?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setDone({ ratingA: data.ratingA!, ratingB: data.ratingB! });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  const opponent = memos.find((m) => m.memoId === opponentId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}>

        {done ? (
          <>
            <h2 className="text-base font-semibold text-green-700 mb-3">Comparison recorded ✓</h2>
            <p className="text-sm text-gray-600 mb-2">
              <strong>{currentMemoName}</strong>: {Math.round(done.ratingA)} ELO
            </p>
            {opponent && (
              <p className="text-sm text-gray-600 mb-5">
                <strong>{opponent.name}</strong>: {Math.round(done.ratingB)} ELO
              </p>
            )}
            <button onClick={() => { onClose(); window.location.reload(); }}
              className="w-full px-4 py-2 bg-brand-orange text-white rounded-lg text-sm font-medium">
              Done
            </button>
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Add to ELO Comparison</h2>
            <p className="text-xs text-gray-500 mb-5">
              Which memo is more useful for making its decision? Rate based on decision-utility, not overall quality.
            </p>

            {/* Opponent picker */}
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-500 block mb-1">Compare against</label>
              {loading ? (
                <p className="text-xs text-gray-400 italic">Loading memos…</p>
              ) : memos.length === 0 ? (
                <p className="text-xs text-gray-400 italic">
                  No other memos available. Score another memo first.
                </p>
              ) : (
                <select value={opponentId} onChange={(e) => setOpponentId(e.target.value ? parseInt(e.target.value) : "")}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-ring">
                  <option value="">Select a memo…</option>
                  {memos.map((m) => (
                    <option key={m.memoId} value={m.memoId}>
                      {m.name} (ELO: {Math.round(m.rating)})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Winner */}
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-500 block mb-2">More decision-useful memo</label>
              <div className="grid grid-cols-3 gap-2">
                {([["A", currentMemoName], ["TIE", "Tie"], ["B", opponent?.name ?? "Other memo"]] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setWinner(v)}
                    className={`text-xs py-2 px-3 rounded-lg border font-medium transition-colors ${winner === v ? "bg-brand-orange text-white border-brand-orange" : "border-gray-200 text-gray-600 hover:border-brand-orange-ring"}`}>
                    {v === "A" ? "This memo" : v === "B" ? "The other" : "Tie"}
                    <span className="block text-xs opacity-70 truncate">{label as string}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Margin */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Margin</label>
                <select value={margin} onChange={(e) => setMargin(e.target.value as typeof margin)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                  <option value="CLEAR">Clear</option>
                  <option value="MODERATE">Moderate</option>
                  <option value="SLIGHT">Slight</option>
                  <option value="AMBIGUOUS">Ambiguous</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Confidence</label>
                <select value={confidence} onChange={(e) => setConfidence(e.target.value as typeof confidence)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
            </div>

            {/* Reasoning */}
            <div className="mb-5">
              <label className="text-xs font-medium text-gray-500 block mb-1">Reasoning (optional)</label>
              <input value={reasoning} onChange={(e) => setReasoning(e.target.value)}
                placeholder="e.g. clearer recommendation, better evidence…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-ring" />
            </div>

            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button
                onClick={submit}
                disabled={busy || !opponentId}
                className="flex-1 px-4 py-2 bg-brand-orange text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {busy ? "Saving…" : "Record comparison"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Delete confirm modal ─────────────────────────────────────────────────────

function DeleteModal({
  runId,
  onClose,
}: {
  runId: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirmDelete() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/scorecard/${runId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      router.push("/history");
    } catch {
      setError("Failed to delete. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}>
        {step === 1 ? (
          <>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Delete this scoring run?</h2>
            <p className="text-sm text-gray-500 mb-5">
              This will permanently delete all scores, gaps, edits, diagnostics, and confirmed risks
              for Run #{runId}. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => setStep(2)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                Continue →
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold text-red-700 mb-2">Confirm permanent deletion</h2>
            <p className="text-sm text-gray-500 mb-5">
              Are you sure? Run #{runId} and all its associated data will be deleted immediately.
            </p>
            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
            <div className="flex gap-3">
              <button onClick={onClose} disabled={busy}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={busy}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {busy ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Overflow menu ────────────────────────────────────────────────────────────

function OverflowMenu({ run, onDelete, onEdit }: { run: RunData; onDelete: () => void; onEdit: () => void }) {
  const [open, setOpen] = useState(false);

  function exportRunCSV() {
    setOpen(false);
    const rows = [
      ["Field", "Value"],
      ["Run ID", String(run.id)],
      ["Memo", run.memo.name],
      ["Typology", run.memo.typology],
      ["Rubric Version", run.rubricVersion],
      ["Scored At", new Date(run.scoredAt).toLocaleDateString()],
      ["Memo Confidence", run.memoConfidence.toFixed(1)],
      ["Decision Confidence", run.decisionConfidence.toFixed(1)],
      ["Status Badge", run.statusBadge],
      ["Stage 1 Average", run.stage1Avg.toFixed(2)],
      ["Stage 2 Average", run.stage2Avg.toFixed(2)],
      [],
      ["Dimension", "Score"],
      ...run.dimensionScores.map((d) => [d.dimensionKey, d.serverComputed !== null ? d.serverComputed.toFixed(2) : "Not scored"]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scorecard-run-${run.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-brand-orange-ring"
        aria-label="More actions">
        ⋯
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-40 bg-white border border-gray-200 rounded-xl shadow-lg w-44 py-1 overflow-hidden">
            <button
              onClick={exportRunCSV}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Export as CSV
            </button>
            <button
              onClick={() => { setOpen(false); onEdit(); }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Edit memo details
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button
              onClick={() => { setOpen(false); onDelete(); }}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
              Delete this run…
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

// ─── Edit memo modal ─────────────────────────────────────────────────────────

const TYPOLOGY_OPTIONS = [
  { value: "ONE_A", label: "1A — External Investment" },
  { value: "ONE_B", label: "1B — Internal Initiative" },
  { value: "TWO_A", label: "2A — New Market Entry" },
  { value: "TWO_B", label: "2B — New Product Launch" },
];

function EditMemoModal({
  memo,
  onClose,
  onSaved,
}: {
  memo: RunData["memo"];
  onClose: () => void;
  onSaved: (updated: { name: string; typology: string; notes: string | null }) => void;
}) {
  const [name, setName] = useState(memo.name);
  const [typology, setTypology] = useState(memo.typology);
  const [notes, setNotes] = useState(memo.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!name.trim()) { setError("Name is required."); return; }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/memo/${memo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), typology, notes: notes.trim() || null }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      onSaved({ name: name.trim(), typology, notes: notes.trim() || null });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold mb-4">Edit memo details</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-ring"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Typology</label>
            <select
              value={typology}
              onChange={(e) => setTypology(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-ring">
              {TYPOLOGY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-orange-ring"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
          <button
            onClick={handleSave}
            disabled={busy}
            className="flex-1 px-4 py-2 bg-brand-orange text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-brand-orange-hover transition-colors">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = "gaps" | "edits" | "breakdown" | "explanation" | "recovery" | "redundancy";

export function ScorecardClient({ run: initialRun }: { run: RunData }) {
  const [run, setRun] = useState(initialRun);
  const [activeTab, setActiveTab] = useState<Tab>("gaps");
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [showEloModal, setShowEloModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  function handleChipClick(key: string) {
    setActiveTab("breakdown");
    setFocusKey(key);
    setTimeout(() => {
      document.getElementById(`breakdown-row-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "gaps", label: "Gaps", count: run.gaps.length },
    { id: "edits", label: "Edits", count: run.edits.length },
    { id: "breakdown", label: "Breakdown" },
    { id: "explanation", label: "Explanation" },
    { id: "recovery", label: "Recovery" },
    { id: "redundancy", label: "Redundancy" },
  ];

  return (
    <>
      <TopBar
        title={run.memo.name}
        actions={<OverflowMenu run={run} onDelete={() => setShowDelete(true)} onEdit={() => setShowEditModal(true)} />}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[860px] mx-auto px-6 py-6 space-y-4">

          {/* Memo meta */}
          <div className="flex items-baseline gap-3">
            <p className="text-sm text-gray-500">{TYPOLOGY_LABELS[run.memo.typology] ?? run.memo.typology}</p>
            <span className="text-gray-200">·</span>
            <p className="text-xs text-gray-400">Run #{run.id} · {run.rubricVersion}</p>
          </div>

          {/* 1. Diagnostics strip */}
          <DiagnosticsStrip diagnostics={run.diagnostics} />

          {/* 1b. Critical Risks Addressed — informational, v1.5 bridge */}
          <CriticalRisksPanel risks={run.confirmedRisks} />

          {/* 2. Hero */}
          <HeroBlock run={run} />

          {/* 3. Stage matrix */}
          <StageMatrix run={run} />

          {/* 4. ELO + version */}
          <EloVersionCard run={run} onAddElo={() => setShowEloModal(true)} />

          {/* 5. Chip strip */}
          <ChipStrip run={run} onChipClick={handleChipClick} />

          {/* 6. Tabs */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-gray-200 overflow-x-auto">
              {tabs.map((t) => (
                <button key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === t.id
                      ? "border-brand-orange text-brand-orange"
                      : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
                  }`}>
                  {t.label}
                  {t.count !== undefined && (
                    <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                      activeTab === t.id ? "bg-orange-100 text-brand-orange-hover" : "bg-gray-100 text-gray-500"
                    }`}>
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="p-5">
              {activeTab === "gaps" && <GapsTab gaps={run.gaps} dimensionScores={run.dimensionScores} />}
              {activeTab === "edits" && <EditsTab edits={run.edits} />}
              {activeTab === "breakdown" && <BreakdownTab run={run} focusKey={focusKey} />}
              {activeTab === "explanation" && <ExplanationTab run={run} />}
              {activeTab === "recovery" && <RecoveryTab run={run} gaps={run.gaps} />}
              {activeTab === "redundancy" && <RedundancyTab redundancy={run.redundancyAnalysis} />}
            </div>
          </div>

          <div className="pb-8" />
        </div>
      </main>

      {showDelete && <DeleteModal runId={run.id} onClose={() => setShowDelete(false)} />}
      {showEloModal && (
        <EloComparisonModal
          currentMemoId={run.memo.id}
          currentMemoName={run.memo.name}
          onClose={() => setShowEloModal(false)}
        />
      )}
      {showEditModal && (
        <EditMemoModal
          memo={run.memo}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) =>
            setRun((prev) => ({
              ...prev,
              memo: { ...prev.memo, ...updated },
            }))
          }
        />
      )}
    </>
  );
}
