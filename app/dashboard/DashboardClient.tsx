"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DataTable,
  StatusDot,
  type ColDef,
} from "@/components/shared/DataTable";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SummaryCards {
  totalMemos: number;
  avgConfidence: number | null;
  readyToShip: number;
  needsWork: number;
  majorRework: number;
  totalFramingsChecked: number;
  framingsReady: number;
  framingsAttention: number;
}

export interface RecentMemo {
  memoId: number;
  memoName: string;
  typology: string;
  runId: number;
  memoConfidence: number;
  statusBadge: string;
  scoredAt: string;
}

export interface RecentCheck {
  checkId: number;
  framingName: string;
  verdict: string;
  typology: string | null;
  passCount: number;
  failCount: number;
  createdAt: string;
}

export interface AlertItem {
  type: "memo" | "framing";
  id: number;
  name: string;
  badge: string;
  score: number | null;
  date: string;
  href: string;
}

export interface EloEntry {
  memoId: number;
  memoName: string;
  rating: number;
  comparisonCount: number;
  latestRunId: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPOLOGY_LABELS: Record<string, string> = {
  ONE_A: "1A", ONE_B: "1B", TWO_A: "2A", TWO_B: "2B",
};

// ─── Summary card atom ────────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, accent,
}: {
  label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-extrabold ${accent ?? "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, href, hrefLabel = "View all →" }: {
  title: string; href?: string; hrefLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
      {href && (
        <Link href={href} className="text-xs text-brand-orange hover:underline">
          {hrefLabel}
        </Link>
      )}
    </div>
  );
}

// ─── Type pill (memo / framing) ───────────────────────────────────────────────

function TypePill({ type }: { type: "memo" | "framing" }) {
  return (
    <span className={`text-xs rounded-full px-1.5 py-0.5 font-medium ${
      type === "memo" ? "bg-brand-orange-light text-brand-orange" : "bg-indigo-50 text-indigo-600"
    }`}>
      {type === "memo" ? "Memo" : "Framing"}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  summary: SummaryCards;
  recentMemos: RecentMemo[];
  recentChecks: RecentCheck[];
  alertItems: AlertItem[];
  eloLeaderboard: EloEntry[];
}

export function DashboardClient({ summary, recentMemos, recentChecks, alertItems, eloLeaderboard }: Props) {
  const router = useRouter();
  const hasAnyData = summary.totalMemos > 0 || summary.totalFramingsChecked > 0;

  // ── Recent Activity: interleave memos + checks, sort by date ──
  type ActivityRow = {
    key: string;
    type: "memo" | "framing";
    name: string;
    sub: string;
    badge: string;
    score: number | null;
    date: string;
    href: string;
  };

  const activityRows: ActivityRow[] = [
    ...recentMemos.map((m): ActivityRow => ({
      key: `memo-${m.runId}`,
      type: "memo",
      name: m.memoName,
      sub: `${TYPOLOGY_LABELS[m.typology] ?? m.typology} · Run #${m.runId}`,
      badge: m.statusBadge,
      score: m.memoConfidence,
      date: m.scoredAt,
      href: `/scorecard/${m.runId}`,
    })),
    ...recentChecks.map((c): ActivityRow => ({
      key: `check-${c.checkId}`,
      type: "framing",
      name: c.framingName,
      sub: `${c.typology ?? "auto"} · ${c.passCount}✓ ${c.failCount}✗`,
      badge: c.verdict,
      score: null,
      date: c.createdAt,
      href: `/sanity-check/${c.checkId}`,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 7);

  const activityCols: ColDef<ActivityRow>[] = [
    {
      key: "type",
      header: "",
      width: "w-16",
      render: (r) => <TypePill type={r.type} />,
    },
    {
      key: "name",
      header: "Name",
      render: (r) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
          <p className="text-xs text-gray-400">{r.sub}</p>
        </div>
      ),
    },
    {
      key: "score",
      header: "Score",
      width: "w-16",
      align: "right",
      hideOnMobile: true,
      render: (r) => (
        r.score != null
          ? <span className="text-sm font-semibold text-gray-700 tabular-nums">{r.score.toFixed(1)}</span>
          : <span className="text-gray-300 text-sm">—</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-36",
      render: (r) => <StatusDot status={r.badge} />,
    },
    {
      key: "date",
      header: "Modified",
      width: "w-24",
      hideOnMobile: true,
      render: (r) => <span className="text-xs text-gray-400">{new Date(r.date).toLocaleDateString()}</span>,
    },
  ];

  // ── Needs Attention ──
  const alertCols: ColDef<AlertItem>[] = [
    {
      key: "type",
      header: "",
      width: "w-16",
      render: (r) => <TypePill type={r.type} />,
    },
    {
      key: "name",
      header: "Name",
      render: (r) => (
        <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
      ),
    },
    {
      key: "score",
      header: "Score",
      width: "w-16",
      align: "right",
      hideOnMobile: true,
      render: (r) => (
        r.score != null
          ? <span className="text-sm font-semibold text-red-600 tabular-nums">{r.score.toFixed(1)}</span>
          : <span className="text-gray-300 text-sm">—</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-36",
      render: (r) => <StatusDot status={r.badge} />,
    },
    {
      key: "date",
      header: "Modified",
      width: "w-24",
      hideOnMobile: true,
      render: (r) => <span className="text-xs text-gray-400">{new Date(r.date).toLocaleDateString()}</span>,
    },
  ];

  // DataTable doesn't pass index to render; embed rank in the row object
  const eloWithIndex = eloLeaderboard.map((e, i) => ({ ...e, _rank: i }));
  const eloColsIndexed: ColDef<EloEntry & { _rank: number }>[] = [
    {
      key: "rank",
      header: "#",
      width: "w-10",
      render: (r) => <span className="text-sm font-bold text-gray-200">{r._rank + 1}</span>,
    },
    {
      key: "name",
      header: "Memo",
      render: (r) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{r.memoName}</p>
          <p className="text-xs text-gray-400">{r.comparisonCount} comparison{r.comparisonCount !== 1 ? "s" : ""}</p>
        </div>
      ),
    },
    {
      key: "rating",
      header: "ELO",
      width: "w-20",
      align: "right",
      render: (r) => <span className="text-base font-bold text-brand-orange">{Math.round(r.rating)}</span>,
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1100px] mx-auto px-6 py-6 space-y-8">

        {/* ── Top bar: primary CTA (right-aligned, like reference) ─────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Overview</h2>
            <p className="text-xs text-gray-400 mt-0.5">Latest run per memo · latest check per framing</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/upload-framing"
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Run Sanity Check
            </Link>
            {/* Primary action: prominent orange, top-right per reference */}
            <Link
              href="/score-memo"
              className="px-4 py-2 bg-brand-orange text-white rounded-xl text-sm font-semibold hover:bg-brand-orange-hover transition-colors shadow-sm"
            >
              + Score a Memo
            </Link>
          </div>
        </div>

        {/* ── Empty state ───────────────────────────────────────────────────── */}
        {!hasAnyData && (
          <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-16 text-center">
            <p className="text-2xl font-bold text-gray-900 mb-2">Nothing scored yet</p>
            <p className="text-sm text-gray-500 mb-6">Score a memo or run a framing sanity check to start.</p>
            <div className="flex gap-3 justify-center">
              <Link href="/score-memo" className="px-6 py-3 bg-brand-orange text-white rounded-xl font-semibold hover:bg-brand-orange-hover transition-colors">
                Score your first memo
              </Link>
              <Link href="/upload-framing" className="px-6 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Check a framing
              </Link>
            </div>
          </div>
        )}

        {/* ── Memo health cards ─────────────────────────────────────────────── */}
        {summary.totalMemos > 0 && (
          <div>
            <SectionHeader title="Memo Health" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SummaryCard
                label="Memos scored"
                value={String(summary.totalMemos)}
                sub="distinct memos"
              />
              <SummaryCard
                label="Avg Readiness"
                value={summary.avgConfidence != null ? summary.avgConfidence.toFixed(1) : "—"}
                sub="per latest run"
              />
              <SummaryCard
                label="Ready to Ship"
                value={String(summary.readyToShip)}
                sub={`of ${summary.totalMemos}`}
                accent="text-green-700"
              />
              <SummaryCard
                label="Needs Attention"
                value={String(summary.majorRework + summary.needsWork)}
                sub={[
                  summary.majorRework > 0 && `${summary.majorRework} rework`,
                  summary.needsWork > 0 && `${summary.needsWork} needs work`,
                ].filter(Boolean).join(", ") || "all clear"}
                accent={summary.majorRework > 0 ? "text-red-600" : summary.needsWork > 0 ? "text-amber-700" : "text-gray-900"}
              />
            </div>
          </div>
        )}

        {/* ── Framing health cards ──────────────────────────────────────────── */}
        <div>
          <SectionHeader title="Framing Health" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <SummaryCard
              label="Framings checked"
              value={summary.totalFramingsChecked > 0 ? String(summary.totalFramingsChecked) : "—"}
              sub={summary.totalFramingsChecked === 0 ? "no sanity checks yet" : "distinct framings"}
            />
            <SummaryCard
              label="Ready for Delivery"
              value={summary.totalFramingsChecked === 0 ? "—" : String(summary.framingsReady)}
              sub={summary.totalFramingsChecked === 0 ? "run a sanity check" : `of ${summary.totalFramingsChecked}`}
              accent="text-green-700"
            />
            <SummaryCard
              label="Needs Revision"
              value={summary.totalFramingsChecked === 0 ? "—" : String(summary.framingsAttention)}
              sub={summary.framingsAttention === 0 && summary.totalFramingsChecked > 0 ? "all framings clear" : "revisions or rework"}
              accent={summary.framingsAttention > 0 ? "text-red-600" : "text-gray-900"}
            />
          </div>
        </div>

        {/* ── Recent Activity — data table ──────────────────────────────────── */}
        {activityRows.length > 0 && (
          <div>
            <SectionHeader title="Recent Activity" href="/history" />
            <DataTable
              columns={activityCols}
              rows={activityRows}
              rowKey={(r) => r.key}
              onRowClick={(r) => router.push(r.href)}
              emptyMessage="No recent activity."
            />
          </div>
        )}

        {/* ── Needs Attention ───────────────────────────────────────────────── */}
        {alertItems.length > 0 && (
          <div>
            <SectionHeader title="Needs Attention" href="/history" />
            <DataTable
              columns={alertCols}
              rows={alertItems}
              rowKey={(r) => `${r.type}-${r.id}`}
              onRowClick={(r) => router.push(r.href)}
              emptyMessage="No alerts."
            />
          </div>
        )}

        {alertItems.length === 0 && summary.totalMemos > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
            <p className="text-sm text-green-600">✓ No memos or framings flagged for rework.</p>
          </div>
        )}

        {/* ── ELO leaderboard ───────────────────────────────────────────────── */}
        <div>
          <SectionHeader title="ELO Leaderboard" href="/history" />
          {eloLeaderboard.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center">
              <p className="text-sm text-gray-400 italic">No ELO comparisons yet.</p>
              <p className="text-xs text-gray-400 mt-1">Open any scorecard to add an ELO comparison.</p>
            </div>
          ) : (
            <DataTable
              columns={eloColsIndexed}
              rows={eloWithIndex}
              rowKey={(r) => r.memoId}
              onRowClick={(r) => r.latestRunId && router.push(`/scorecard/${r.latestRunId}`)}
              emptyMessage="No ELO data."
            />
          )}
        </div>

      </div>
    </div>
  );
}
