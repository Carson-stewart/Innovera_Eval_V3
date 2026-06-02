"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shell/TopBar";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SanityIssueRow {
  id: number;
  sanityCheckId: number;
  checkId: string;
  category: string;
  issue: string;
  impact: string;
  fix: string;
  severity: string;         // Severity enum: HIGH / MEDIUM / LOW
  fidelityTier: string;
  confidence: number;
  evidenceBasis: string;
  location: string | null;
  rewrite: string | null;
  escalated: boolean;
}

export interface SanityCheckData {
  id: number;
  framingId: number;
  verdict: string;
  passCount: number;
  failCount: number;
  enhanceCount: number;     // stores advisory (Cat A) + enhancement findings combined
  typology: string | null;
  typologyConfidence: string | null; // "HIGH" | "MEDIUM" | "LOW" (not a number)
  triageMatrix: Record<string, unknown> | null; // { checkId: "PASS"|"FAIL"|"ADVISORY"|"NA" }
  revisedFraming: string | null;    // auto-generated run summary — shown in diagnostics
  createdAt: string;
  sanityIssues: SanityIssueRow[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VERDICT_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  READY_FOR_DELIVERY:  { label: "Ready for Delivery",  bg: "bg-green-50", text: "text-green-800",  border: "border-green-300"  },
  REVISIONS_REQUIRED:  { label: "Revisions Required",  bg: "bg-amber-50", text: "text-amber-800",  border: "border-amber-300"  },
  MAJOR_REWORK_NEEDED: { label: "Major Rework Needed", bg: "bg-red-50",   text: "text-red-800",    border: "border-red-300"    },
};

const SEV_STYLES: Record<string, string> = {
  HIGH:   "bg-red-100 text-red-800 border border-red-300",
  MEDIUM: "bg-amber-100 text-amber-800 border border-amber-300",
  LOW:    "bg-blue-100 text-blue-800 border border-blue-300",
};

const FIDELITY_STYLES: Record<string, string> = {
  HIGH:   "bg-green-100 text-green-700 border border-green-200",
  MEDIUM: "bg-yellow-100 text-yellow-700 border border-yellow-200",
  LOW:    "bg-gray-100 text-gray-600 border border-gray-200",
};

const CATEGORY_LABELS: Record<string, string> = {
  A: "A — Logical Integrity",
  B: "B — Completeness",
  C: "C — Structural Integrity",
  D: "D — Rule Compliance",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isEscalated(issue: SanityIssueRow): boolean {
  return (
    issue.escalated ||
    issue.confidence < 0.7 ||
    issue.evidenceBasis === "Structurally inferred"
  );
}

/** Sort by fidelity HIGH → MEDIUM → LOW, then by severity within the same fidelity. */
const BY_FIDELITY = (a: SanityIssueRow, b: SanityIssueRow): number => {
  const fi: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const fd = (fi[a.fidelityTier] ?? 9) - (fi[b.fidelityTier] ?? 9);
  if (fd !== 0) return fd;
  const si: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return (si[a.severity?.toUpperCase()] ?? 9) - (si[b.severity?.toUpperCase()] ?? 9);
};

/**
 * Assemble the Revised Framing text from per-finding rewrites.
 * Sorted Critical → Structural → Enhancement, HIGH-fidelity first within each group.
 * This is what goes in the editable Revised Framing panel.
 * The auto-summary stub (stored in check.revisedFraming) goes in Diagnostics instead.
 */
function assembleRevisedFraming(issues: SanityIssueRow[]): string {
  const withRewrites = issues
    .filter((i) => i.rewrite && i.rewrite.trim())
    .sort(BY_FIDELITY);

  if (withRewrites.length === 0) {
    return "No specific rewrites were generated for this run.\n\nReview the Consolidated Report above and apply the suggested fixes manually to your framing document.";
  }

  const groups: { label: string; items: SanityIssueRow[] }[] = [
    { label: "CRITICAL FIXES", items: withRewrites.filter((i) => i.severity?.toUpperCase() === "HIGH") },
    { label: "STRUCTURAL FIXES", items: withRewrites.filter((i) => i.severity?.toUpperCase() === "MEDIUM") },
    { label: "ENHANCEMENTS", items: withRewrites.filter((i) => i.severity?.toUpperCase() === "LOW") },
  ].filter((g) => g.items.length > 0);

  const sections = groups.map(({ label, items }) => {
    const block = items
      .map(
        (i) =>
          `[${i.checkId}] ${i.category}-Category · Fidelity: ${i.fidelityTier}\n` +
          `Issue: ${i.issue}\n` +
          `Suggested rewrite:\n${i.rewrite}`
      )
      .join("\n\n");
    return `── ${label} ──\n\n${block}`;
  });

  return sections.join("\n\n" + "─".repeat(60) + "\n\n");
}

/**
 * Parse the triageMatrix JSON (checkId → status) into a
 * category × status structure, including PASS counts.
 * This is the source of truth for the Triage Matrix — SanityIssue rows
 * alone are insufficient because passing checks aren't stored there.
 */
type CheckStatus = "PASS" | "FAIL" | "ADVISORY" | "NA";

function parseTriageMatrix(
  triageMatrix: Record<string, unknown> | null
): Record<string, Record<CheckStatus, string[]>> | null {
  if (!triageMatrix) return null;

  const result: Record<string, Record<CheckStatus, string[]>> = {
    A: { PASS: [], FAIL: [], ADVISORY: [], NA: [] },
    B: { PASS: [], FAIL: [], ADVISORY: [], NA: [] },
    C: { PASS: [], FAIL: [], ADVISORY: [], NA: [] },
    D: { PASS: [], FAIL: [], ADVISORY: [], NA: [] },
  };

  for (const [checkId, rawStatus] of Object.entries(triageMatrix)) {
    const cat = checkId[0];   // "A", "B", "C", "D"
    const status = String(rawStatus) as CheckStatus;
    if (result[cat] && (status === "PASS" || status === "FAIL" || status === "ADVISORY" || status === "NA")) {
      result[cat][status].push(checkId);
    }
  }

  return result;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Tag({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function FindingCard({ issue }: { issue: SanityIssueRow }) {
  const escalated = isEscalated(issue);
  return (
    <div className={`rounded-lg border bg-white p-4 space-y-2 ${escalated ? "border-amber-400" : "border-gray-200"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Tag
          label={issue.severity ?? "UNKNOWN"}
          className={SEV_STYLES[issue.severity?.toUpperCase()] ?? "bg-gray-100 text-gray-700 border border-gray-200"}
        />
        <Tag
          label={`Fidelity: ${issue.fidelityTier}`}
          className={FIDELITY_STYLES[issue.fidelityTier] ?? "bg-gray-100 text-gray-600 border border-gray-200"}
        />
        <Tag
          label={issue.evidenceBasis}
          className="bg-gray-100 text-gray-600 border border-gray-200"
        />
        {escalated && (
          <Tag label="Escalated" className="bg-amber-100 text-amber-800 border border-amber-300" />
        )}
        <span className="ml-auto text-xs text-gray-400 font-mono">{issue.checkId}</span>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Issue</p>
        <p className="text-sm text-gray-700">{issue.issue}</p>
      </div>

      {issue.impact && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Impact</p>
          <p className="text-sm text-gray-700">{issue.impact}</p>
        </div>
      )}

      {issue.fix && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fix</p>
          <p className="text-sm text-gray-700">{issue.fix}</p>
        </div>
      )}

      {issue.location && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</p>
          <blockquote className="mt-1 border-l-2 border-gray-300 pl-3 text-xs text-gray-500 italic">
            {issue.location}
          </blockquote>
        </div>
      )}

      {issue.rewrite && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Suggested Rewrite</p>
          <p className="mt-1 text-xs text-gray-600 bg-gray-50 rounded p-2 whitespace-pre-wrap">{issue.rewrite}</p>
        </div>
      )}
    </div>
  );
}

function FindingGroup({ title, issues, accent }: {
  title: string;
  issues: SanityIssueRow[];
  accent: string;
}) {
  if (issues.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className={`text-sm font-bold uppercase tracking-widest ${accent}`}>
        {title} ({issues.length})
      </h3>
      {issues.map((issue) => (
        <FindingCard key={issue.id} issue={issue} />
      ))}
    </div>
  );
}

// ─── Triage Matrix ────────────────────────────────────────────────────────────

const STATUS_COLS: CheckStatus[] = ["PASS", "FAIL", "ADVISORY", "NA"];

const STATUS_CELL_STYLES: Record<CheckStatus, string> = {
  PASS:     "bg-green-100 text-green-800",
  FAIL:     "bg-red-100 text-red-800",
  ADVISORY: "bg-amber-100 text-amber-800",
  NA:       "bg-gray-100 text-gray-500",
};

function TriageMatrix({ check }: { check: SanityCheckData }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  // Build issuesByCheckId for expanding FAIL/ADVISORY cells
  const issueByCheckId = Object.fromEntries(
    check.sanityIssues.map((i) => [i.checkId, i])
  );

  const parsed = parseTriageMatrix(check.triageMatrix);

  if (!parsed) {
    return (
      <p className="text-sm text-gray-400 italic">
        Triage matrix not available for this run.
      </p>
    );
  }

  const cellKey = (cat: string, status: string) => `${cat}-${status}`;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-52">
                Category
              </th>
              {STATUS_COLS.map((s) => (
                <th
                  key={s}
                  className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide"
                >
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(["A", "B", "C", "D"] as const).map((cat) => (
              <tr key={cat} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-700 text-xs">
                  {CATEGORY_LABELS[cat] ?? cat}
                </td>
                {STATUS_COLS.map((status) => {
                  const checkIds = parsed[cat]?.[status] ?? [];
                  const key = cellKey(cat, status);
                  const isOpen = expanded === key;
                  // Escalated = any check in this cell has a low-confidence or structurally-inferred issue
                  const hasEscalated = checkIds.some((cid) => {
                    const iss = issueByCheckId[cid];
                    return iss ? isEscalated(iss) : false;
                  });

                  return (
                    <td key={status} className="px-4 py-3 text-center">
                      {checkIds.length > 0 ? (
                        <button
                          onClick={() => setExpanded(isOpen ? null : key)}
                          className={`
                            inline-flex items-center justify-center min-w-[2rem] px-2.5 py-1
                            rounded font-semibold text-sm cursor-pointer
                            transition-opacity hover:opacity-80
                            ${STATUS_CELL_STYLES[status]}
                            ${hasEscalated ? "ring-2 ring-amber-400" : ""}
                          `}
                          title={hasEscalated ? "Contains escalated check (low confidence or structurally inferred)" : undefined}
                        >
                          {checkIds.length}
                        </button>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        <span>
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />
          Amber ring = escalated check (confidence &lt; 0.7 or structurally inferred evidence)
        </span>
        <span>Click a count to expand checks in that cell.</span>
      </div>

      {/* Expanded cell detail */}
      {expanded && (() => {
        const [cat, status] = expanded.split("-") as [string, CheckStatus];
        const checkIds = parsed[cat]?.[status] ?? [];
        const issueRows = checkIds
          .map((cid) => issueByCheckId[cid])
          .filter(Boolean) as SanityIssueRow[];
        const passOnly = status === "PASS" || status === "NA";

        return (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                {CATEGORY_LABELS[cat] ?? cat} — {status} ({checkIds.length})
              </p>
              <button
                onClick={() => setExpanded(null)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Close ×
              </button>
            </div>

            {passOnly ? (
              <div className="space-y-1">
                <p className="text-xs text-gray-500 mb-2">
                  These checks passed or were not applicable — no findings recorded.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {checkIds.map((cid) => (
                    <span key={cid} className="font-mono text-xs bg-white border border-gray-200 rounded px-2 py-0.5 text-gray-600">
                      {cid}
                    </span>
                  ))}
                </div>
              </div>
            ) : issueRows.length > 0 ? (
              issueRows.map((issue) => (
                <FindingCard key={issue.id} issue={issue} />
              ))
            ) : (
              <div className="space-y-1">
                <p className="text-xs text-gray-500 mb-2">
                  Check IDs in this cell (issue details not stored for this status):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {checkIds.map((cid) => (
                    <span key={cid} className="font-mono text-xs bg-white border border-gray-200 rounded px-2 py-0.5 text-gray-600">
                      {cid}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Severity groups for Consolidated Report ──────────────────────────────────

function groupBySeverity(issues: SanityIssueRow[]): {
  critical: SanityIssueRow[];
  structural: SanityIssueRow[];
  enhancement: SanityIssueRow[];
} {
  const critical: SanityIssueRow[] = [];
  const structural: SanityIssueRow[] = [];
  const enhancement: SanityIssueRow[] = [];

  for (const issue of issues) {
    const sev = issue.severity?.toUpperCase() ?? "";
    if (sev === "HIGH") critical.push(issue);
    else if (sev === "MEDIUM") structural.push(issue);
    else enhancement.push(issue); // LOW → Enhancement / Advisory
  }

  return {
    critical: critical.sort(BY_FIDELITY),
    structural: structural.sort(BY_FIDELITY),
    enhancement: enhancement.sort(BY_FIDELITY),
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

// ─── Report tab type ──────────────────────────────────────────────────────────
type ReportTab = "critical" | "structural" | "advisory";

export function SanityCheckClient({ check }: { check: SanityCheckData }) {
  const router = useRouter();

  // Revised framing = assembled from per-check rewrites (NOT the DB auto-summary)
  const [revisedFraming, setRevisedFraming] = useState(() =>
    assembleRevisedFraming(check.sanityIssues)
  );
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle");
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  // Default to whichever tab has findings; "critical" if any, else "structural", else "advisory"
  const [reportTab, setReportTab] = useState<ReportTab>("critical");

  const verdict = VERDICT_CONFIG[check.verdict] ?? {
    label: check.verdict,
    bg: "bg-gray-50",
    text: "text-gray-800",
    border: "border-gray-300",
  };

  const { critical, structural, enhancement } = groupBySeverity(check.sanityIssues);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(revisedFraming).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [revisedFraming]);

  // Export the revised framing as a Markdown text file — NOT CSV (it's prose, not tabular)
  const handleExportMarkdown = useCallback(() => {
    const md = `# Revised Framing — Sanity Check #${check.id}\n\n` +
      `**Typology detected:** ${check.typology ?? "unknown"} (${check.typologyConfidence ?? "—"} confidence)\n` +
      `**Verdict:** ${check.verdict}\n` +
      `**Pass:** ${check.passCount}  **Fail:** ${check.failCount}  **Advisory:** ${check.enhanceCount}\n\n` +
      `---\n\n` +
      revisedFraming;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revised-framing-${check.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [check, revisedFraming]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/sanity-check/${check.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/sanity-check");
      } else {
        alert("Delete failed. Please try again.");
        setDeleteStep("idle");
      }
    } finally {
      setDeleting(false);
    }
  }, [check.id, router]);

  // Advisory count = enhanceCount (schema merged advisory into enhanceCount)
  const advisoryCount = check.enhanceCount;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopBar title="Sanity Check" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 space-y-8">

        {/* ── 1. Verdict Banner ─────────────────────────────────────────────── */}
        <div className={`rounded-xl border-2 ${verdict.border} ${verdict.bg} px-6 py-5`}>
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1 min-w-0">
              <p className={`text-2xl font-bold ${verdict.text}`}>{verdict.label}</p>
              <div className="mt-1.5 flex flex-wrap gap-3 text-sm text-gray-600">
                {check.typology && (
                  <span>
                    Typology:{" "}
                    <span className="font-semibold text-gray-800">{check.typology}</span>
                    {check.typologyConfidence && (
                      <span className="ml-1 text-gray-500">({check.typologyConfidence} confidence)</span>
                    )}
                  </span>
                )}
                <span className="text-gray-400">
                  {new Date(check.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Pass / Fail / Advisory chips */}
            <div className="flex flex-wrap gap-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800 border border-green-200">
                <span className="text-base font-extrabold">{check.passCount}</span> Pass
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800 border border-red-200">
                <span className="text-base font-extrabold">{check.failCount}</span> Fail
              </span>
              {advisoryCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                  <span className="text-base font-extrabold">{advisoryCount}</span> Advisory
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── 2. Triage Matrix (Category × Status) ─────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Triage Matrix</h2>
          <p className="text-xs text-gray-500">
            Category rows × check status columns. Counts read from the full 48-check run record
            (including passes). Click any non-zero cell to expand its checks.
          </p>
          <TriageMatrix check={check} />
        </section>

        {/* ── 3. Consolidated Report — tabbed ──────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center border-b border-gray-100 px-1">
            {(
              [
                { id: "critical" as ReportTab,  label: "Critical Fixes",  count: critical.length,    activeColor: "border-red-500 text-red-700",    badgeColor: "bg-red-100 text-red-700"    },
                { id: "structural" as ReportTab, label: "Structural",      count: structural.length,  activeColor: "border-amber-500 text-amber-700", badgeColor: "bg-amber-100 text-amber-700" },
                { id: "advisory" as ReportTab,   label: "Advisory",        count: enhancement.length, activeColor: "border-blue-500 text-blue-700",   badgeColor: "bg-blue-100 text-blue-700"   },
              ] as const
            ).map((tab) => {
              const active = reportTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setReportTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    active
                      ? tab.activeColor
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${active ? tab.badgeColor : "bg-gray-100 text-gray-500"}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
            <span className="ml-auto pr-4 text-xs text-gray-400">HIGH-fidelity first within each group</span>
          </div>

          {/* Tab content */}
          <div className="p-6">
            {check.sanityIssues.length === 0 ? (
              <p className="text-sm text-gray-500">No findings recorded.</p>
            ) : (
              <>
                {reportTab === "critical" && (
                  critical.length === 0
                    ? <p className="text-sm text-gray-400 italic">No critical findings — good.</p>
                    : <div className="space-y-3">{critical.map((i) => <FindingCard key={i.id} issue={i} />)}</div>
                )}
                {reportTab === "structural" && (
                  structural.length === 0
                    ? <p className="text-sm text-gray-400 italic">No structural findings.</p>
                    : <div className="space-y-3">{structural.map((i) => <FindingCard key={i.id} issue={i} />)}</div>
                )}
                {reportTab === "advisory" && (
                  enhancement.length === 0
                    ? <p className="text-sm text-gray-400 italic">No advisory findings.</p>
                    : <div className="space-y-3">{enhancement.map((i) => <FindingCard key={i.id} issue={i} />)}</div>
                )}
              </>
            )}
          </div>
        </section>

        {/* ── 4. Revised Framing Panel ──────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Revised Framing</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Assembled from per-check rewrite suggestions. Edit inline, then copy or export.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
              <button
                onClick={handleExportMarkdown}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Export .md
              </button>
            </div>
          </div>
          <textarea
            value={revisedFraming}
            onChange={(e) => setRevisedFraming(e.target.value)}
            rows={16}
            className="w-full rounded-lg border border-gray-200 p-3 text-sm text-gray-800 font-mono resize-y focus:outline-none focus:ring-2 focus:ring-brand-orange-ring leading-relaxed"
            placeholder="No rewrites generated for this run."
          />
        </section>

        {/* ── 5. Diagnostics Strip (collapsible, collapsed by default) ──────── */}
        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setDiagnosticsOpen((o) => !o)}
            className="w-full flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span>
              Engine diagnostics
              {!diagnosticsOpen && (
                <span className="ml-2 text-xs font-normal text-gray-400">
                  — run summary, check counts, raw matrix
                </span>
              )}
            </span>
            <span className="text-gray-400 text-xs">{diagnosticsOpen ? "▲ collapse" : "▼ expand"}</span>
          </button>

          {diagnosticsOpen && (
            <div className="px-6 pb-6 pt-1 border-t border-gray-100 space-y-4">
              {/* Run summary (the auto-generated text from the Inngest persist step) */}
              {check.revisedFraming && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Run summary
                  </p>
                  <pre className="bg-gray-50 rounded p-3 text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                    {check.revisedFraming}
                  </pre>
                </div>
              )}

              {/* Key metrics */}
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                {[
                  ["Check ID", String(check.id)],
                  ["Framing ID", String(check.framingId)],
                  ["Run at", new Date(check.createdAt).toLocaleString()],
                  ["Issues stored", String(check.sanityIssues.length)],
                  ...(check.typology ? [["Typology", check.typology]] : []),
                  ...(check.typologyConfidence ? [["Typology confidence", check.typologyConfidence]] : []),
                ].map(([dt, dd]) => (
                  <div key={dt}>
                    <dt className="text-xs text-gray-500 font-medium uppercase tracking-wide">{dt}</dt>
                    <dd className="font-mono text-gray-800 text-xs">{dd}</dd>
                  </div>
                ))}
              </dl>

              {/* Raw triage matrix */}
              {check.triageMatrix && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Raw triage matrix (all 48 checks)
                  </p>
                  <pre className="bg-gray-50 rounded p-3 text-xs text-gray-600 overflow-x-auto max-h-48">
                    {JSON.stringify(check.triageMatrix, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── 6. Actions ────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 pb-4">
          {/* Primary CTA — enabled, orange, links to Score Memo with framing pre-loaded */}
          <a
            href={`/score-memo?framingId=${check.framingId}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover active:bg-brand-orange-hover transition-colors shadow-sm"
          >
            Score a memo against this framing
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>

          {deleteStep === "idle" && (
            <button
              onClick={() => setDeleteStep("confirm")}
              className="inline-flex items-center px-4 py-2 rounded-lg border border-red-300 text-red-700 text-sm font-medium hover:bg-red-50 transition-colors"
            >
              Delete this check
            </button>
          )}

          {deleteStep === "confirm" && (
            <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2">
              <span className="text-sm text-red-700 font-medium">
                Delete cannot be undone. Confirm?
              </span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1 rounded bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                onClick={() => setDeleteStep("idle")}
                className="px-3 py-1 rounded border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
