"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DataTable,
  SearchInput,
  FilterSelect,
  StatusDot,
  TableAction,
  type ColDef,
} from "@/components/shared/DataTable";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HistoryRun {
  id: number;
  memoId: number;
  rubricVersion: string;
  memoConfidence: number;
  statusBadge: string;
  stage1Avg: number;
  stage2Avg: number;
  /** P1 coherence-conflict count from persisted subScores; null when not stored */
  p1Conflicts: number | null;
  scoredAt: string;
  memo: { id: number; name: string; typology: string };
  eloRating: number | null;
  eloCount: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPOLOGY_LABELS: Record<string, string> = {
  ONE_A: "1A", ONE_B: "1B", TWO_A: "2A", TWO_B: "2B",
};

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(rows: HistoryRun[]) {
  const headers = ["Run ID", "Memo Name", "Typology", "Readiness", "Conflicts", "Status", "ELO", "Rubric Version", "Date"];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.id,
        `"${r.memo.name.replace(/"/g, '""')}"`,
        TYPOLOGY_LABELS[r.memo.typology] ?? r.memo.typology,
        r.memoConfidence.toFixed(1),
        r.p1Conflicts ?? "",
        r.statusBadge,
        r.eloRating != null ? Math.round(r.eloRating) : "",
        r.rubricVersion,
        new Date(r.scoredAt).toLocaleDateString(),
      ].join(",")
    ),
  ];
  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `innovera-history-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── SVG ELO chart (unchanged) ────────────────────────────────────────────────

interface EloPoint { date: string; rating: number }

function EloProgressionChart({ points }: { points: EloPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center h-20 text-xs text-gray-400 italic">
        Not enough rated runs yet — add ELO comparisons to see progression.
      </div>
    );
  }
  const W = 600; const H = 90; const PX = 28; const PY = 10;
  const ratings = points.map((p) => p.rating);
  const minR = Math.min(...ratings);
  const maxR = Math.max(...ratings);
  const rng = maxR - minR || 50;
  const px = (i: number) => PX + (i / (points.length - 1)) * (W - PX * 2);
  const py = (r: number) => PY + ((maxR - r) / rng) * (H - PY * 2);
  const polyline = points.map((p, i) => `${px(i)},${py(p.rating)}`).join(" ");

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20">
        {[minR, maxR].map((r, i) => (
          <g key={i}>
            <line x1={PX} y1={py(r)} x2={W - PX} y2={py(r)} stroke="#f3f4f6" strokeWidth="1" />
            <text x={PX - 4} y={py(r) + 3} textAnchor="end" fill="#9ca3af" fontSize="9">{Math.round(r)}</text>
          </g>
        ))}
        <polyline points={polyline} fill="none" stroke="var(--brand-orange)" strokeWidth="2" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={px(i)} cy={py(p.rating)} r="3" fill="white" stroke="var(--brand-orange)" strokeWidth="2" />
        ))}
      </svg>
      <div className="flex justify-between text-xs text-gray-400 px-7 -mt-1">
        <span>{new Date(points[0].date).toLocaleDateString()}</span>
        <span>{new Date(points[points.length - 1].date).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

// ─── Delete modal (unchanged) ─────────────────────────────────────────────────

function DeleteModal({ runId, onClose, onDeleted }: {
  runId: number; onClose: () => void; onDeleted: (id: number) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function doDelete() {
    setBusy(true); setErr("");
    const res = await fetch(`/api/scorecard/${runId}`, { method: "DELETE" });
    if (res.ok) { onDeleted(runId); onClose(); }
    else { setErr("Delete failed."); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        {step === 1 ? (
          <>
            <h2 className="text-base font-semibold mb-2">Delete scoring run #{runId}?</h2>
            <p className="text-sm text-gray-500 mb-5">Permanently removes all scores, gaps, diagnostics, and risks. Cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => setStep(2)} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm">Continue →</button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold text-red-700 mb-2">Confirm deletion</h2>
            <p className="text-sm text-gray-500 mb-5">Delete run #{runId} permanently?</p>
            {err && <p className="text-xs text-red-600 mb-3">{err}</p>}
            <div className="flex gap-3">
              <button onClick={onClose} disabled={busy} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50">Cancel</button>
              <button onClick={doDelete} disabled={busy} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50">
                {busy ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  initialRuns: HistoryRun[];
  eloPoints: EloPoint[];
  rubricVersions: string[];
}

export function HistoryClient({ initialRuns, eloPoints, rubricVersions }: Props) {
  const router = useRouter();
  const [runs, setRuns] = useState<HistoryRun[]>(initialRuns);
  const [search, setSearch] = useState("");
  const [filterTypology, setFilterTypology] = useState("");
  const [filterVersion, setFilterVersion] = useState("");
  const [filterBadge, setFilterBadge] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    let rows = runs;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.memo.name.toLowerCase().includes(q));
    }
    if (filterTypology) rows = rows.filter((r) => r.memo.typology === filterTypology);
    if (filterVersion) rows = rows.filter((r) => r.rubricVersion === filterVersion);
    if (filterBadge) rows = rows.filter((r) => r.statusBadge === filterBadge);
    return rows;
  }, [runs, search, filterTypology, filterVersion, filterBadge]);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleDeleted(id: number) {
    setRuns((prev) => prev.filter((r) => r.id !== id));
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }

  const selectedArr = Array.from(selected);
  const canCompare = selectedArr.length === 2;

  if (runs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-12">
        <p className="text-2xl font-bold text-gray-900">No memos scored yet</p>
        <p className="text-sm text-gray-500">Score your first memo to start building your history.</p>
        <a href="/score-memo" className="px-5 py-2.5 bg-brand-orange text-white rounded-xl font-semibold text-sm hover:bg-brand-orange-hover transition-colors">
          Score a Memo
        </a>
      </div>
    );
  }

  // ── Column definitions ──
  const columns: ColDef<HistoryRun>[] = [
    {
      key: "check",
      header: "",
      width: "w-10",
      render: (r) => (
        <input
          type="checkbox"
          checked={selected.has(r.id)}
          onChange={() => toggleSelect(r.id)}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 accent-brand-orange"
        />
      ),
    },
    {
      key: "name",
      header: "Memo",
      render: (r) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{r.memo.name}</p>
          <p className="text-xs text-gray-400">Run #{r.id}</p>
        </div>
      ),
    },
    {
      key: "typology",
      header: "Type",
      width: "w-14",
      hideOnMobile: true,
      render: (r) => (
        <span className="text-xs font-mono text-gray-500">
          {TYPOLOGY_LABELS[r.memo.typology] ?? r.memo.typology}
        </span>
      ),
    },
    {
      key: "confidence",
      header: "Readiness",
      width: "w-28",
      hideOnMobile: true,
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800 tabular-nums w-10 shrink-0">
            {r.memoConfidence.toFixed(1)}
          </span>
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-orange rounded-full"
              style={{ width: `${Math.min(r.memoConfidence, 100)}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      key: "conflicts",
      header: "Conflicts",
      width: "w-20",
      align: "right",
      hideOnMobile: true,
      render: (r) => (
        <span
          className={`text-sm font-mono ${r.p1Conflicts !== null && r.p1Conflicts > 1 ? "text-red-600 font-semibold" : "text-gray-600"}`}
          title="P1 coherence conflicts — memos ship at ≤1"
        >
          {r.p1Conflicts ?? "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-36",
      render: (r) => <StatusDot status={r.statusBadge} />,
    },
    {
      key: "elo",
      header: "ELO",
      width: "w-16",
      align: "right",
      hideOnMobile: true,
      render: (r) => (
        <span className="text-sm font-mono text-gray-600">
          {r.eloRating != null ? Math.round(r.eloRating) : "—"}
        </span>
      ),
    },
    {
      key: "version",
      header: "Version",
      width: "w-24",
      hideOnMobile: true,
      render: (r) => <span className="text-xs text-gray-400">{r.rubricVersion}</span>,
    },
    {
      key: "date",
      header: "Modified",
      width: "w-24",
      hideOnMobile: true,
      render: (r) => (
        <span className="text-xs text-gray-400">
          {new Date(r.scoredAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "w-10",
      align: "right",
      render: (r) => (
        <TableAction danger onClick={() => setDeleteId(r.id)}>
          ✕
        </TableAction>
      ),
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1100px] mx-auto px-6 py-6 space-y-5">

        {/* ELO chart — compact */}
        {eloPoints.length >= 2 && (
          <div className="bg-white border border-gray-200 rounded-xl px-5 pt-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">ELO Progression</p>
              <p className="text-xs text-gray-400">All rated memos</p>
            </div>
            <EloProgressionChart points={eloPoints} />
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by memo name…" />

          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${showFilters ? "border-brand-orange-border text-brand-orange bg-brand-orange-light" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M11 12h2" />
            </svg>
            Sort &amp; Filter
            {(filterTypology || filterVersion || filterBadge) && (
              <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
            )}
          </button>

          <div className="ml-auto flex items-center gap-2">
            {canCompare && (
              <button
                onClick={() => router.push(`/compare?a=${selectedArr[0]}&b=${selectedArr[1]}`)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-brand-orange-border hover:text-brand-orange transition-colors"
              >
                Compare {selectedArr[0]} vs {selectedArr[1]}
              </button>
            )}
            <button
              onClick={() => exportCSV(filtered)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Filter row — collapsible */}
        {showFilters && (
          <div className="flex flex-wrap gap-2 pb-1">
            <FilterSelect
              value={filterTypology}
              onChange={setFilterTypology}
              placeholder="All typologies"
              options={[
                { value: "ONE_A", label: "1A — External Investment" },
                { value: "ONE_B", label: "1B — Internal Initiative" },
                { value: "TWO_A", label: "2A — New Market Entry" },
                { value: "TWO_B", label: "2B — New Product Launch" },
              ]}
            />
            <FilterSelect
              value={filterVersion}
              onChange={setFilterVersion}
              placeholder="All versions"
              options={rubricVersions.map((v) => ({ value: v, label: v }))}
            />
            <FilterSelect
              value={filterBadge}
              onChange={setFilterBadge}
              placeholder="All statuses"
              options={[
                { value: "READY_TO_SHIP", label: "Ready to Ship" },
                { value: "NEEDS_WORK", label: "Needs Work" },
                { value: "MAJOR_REWORK", label: "Major Rework" },
              ]}
            />
            {(filterTypology || filterVersion || filterBadge) && (
              <button
                onClick={() => { setFilterTypology(""); setFilterVersion(""); setFilterBadge(""); }}
                className="px-3 py-2 text-xs text-gray-400 hover:text-gray-700 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Result count */}
        <p className="text-xs text-gray-400">
          {filtered.length} of {runs.length} run{runs.length !== 1 ? "s" : ""}
          {selected.size > 0 && ` · ${selected.size} selected`}
        </p>

        {/* Data table */}
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          onRowClick={(r) => router.push(`/scorecard/${r.id}`)}
          isSelected={(r) => selected.has(r.id)}
          emptyMessage="No runs match these filters."
        />

      </div>

      {deleteId != null && (
        <DeleteModal runId={deleteId} onClose={() => setDeleteId(null)} onDeleted={handleDeleted} />
      )}
    </div>
  );
}
