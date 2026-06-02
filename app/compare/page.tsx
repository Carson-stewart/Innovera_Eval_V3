import { TopBar } from "@/components/shell/TopBar";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { PILLAR_EXPLANATIONS, STAGE_1_KEYS, STAGE_2_KEYS } from "@/lib/pillars/explanations";
import Link from "next/link";

interface Props {
  searchParams: { a?: string; b?: string };
}

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

function DeltaBadge({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.005) return <span className="text-xs text-gray-400">—</span>;
  return (
    <span className={`text-xs font-bold ${delta > 0 ? "text-green-600" : "text-red-600"}`}>
      {delta > 0 ? "+" : ""}{delta.toFixed(2)}
    </span>
  );
}

export default async function ComparePage({ searchParams }: Props) {
  const aId = parseInt(searchParams.a ?? "", 10);
  const bId = parseInt(searchParams.b ?? "", 10);

  if (isNaN(aId) || isNaN(bId) || aId === bId) {
    return (
      <>
        <TopBar title="Version Comparison" />
        <main className="flex-1 p-6 max-w-2xl mx-auto">
          <p className="text-sm text-gray-500">
            Select exactly two runs from{" "}
            <Link href="/history" className="text-brand-orange hover:underline">History</Link> to compare.
          </p>
        </main>
      </>
    );
  }

  const [runA, runB] = await Promise.all([
    prisma.scoringRun.findUnique({
      where: { id: aId },
      include: { memo: true, dimensionScores: true },
    }),
    prisma.scoringRun.findUnique({
      where: { id: bId },
      include: { memo: true, dimensionScores: true },
    }),
  ]);

  if (!runA || !runB) notFound();

  const diffVersion = runA.rubricVersion !== runB.rubricVersion;

  const allKeys = [...STAGE_1_KEYS, ...STAGE_2_KEYS];

  function score(run: typeof runA, key: string): number | null {
    const ds = run!.dimensionScores.find((d) => d.dimensionKey === key);
    return ds?.serverComputed ?? null;
  }

  function scoreColor(s: number | null): string {
    if (s === null) return "text-gray-400";
    if (s >= 4) return "text-green-700";
    if (s >= 3) return "text-amber-700";
    return "text-red-700";
  }

  return (
    <>
      <TopBar title="Version Comparison" />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[900px] mx-auto px-6 py-6 space-y-5">

          {/* Version warning */}
          {diffVersion && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              <strong>Different rubric versions</strong> — {runA.rubricVersion} vs {runB.rubricVersion}.
              Absolute score differences are indicative only; a &ldquo;5&rdquo; can mean different things across versions.
              ELO comparisons are the cross-version-safe measure.
            </div>
          )}

          {/* Run headers side by side */}
          <div className="grid grid-cols-[1fr_80px_1fr] gap-4 items-end">
            {[runA, runB].map((r, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Run {i === 0 ? "A" : "B"}</p>
                <Link href={`/scorecard/${r.id}`}
                  className="text-sm font-semibold text-gray-900 hover:text-brand-orange truncate block">
                  {r.memo.name}
                </Link>
                <p className="text-xs text-gray-400">Run #{r.id} · {r.rubricVersion}</p>
                <p className="text-xs text-gray-400">{new Date(r.scoredAt).toLocaleDateString()}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-2xl font-bold text-gray-900">{r.memoConfidence.toFixed(1)}</span>
                  <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${BADGE_STYLES[r.statusBadge] ?? "bg-gray-100 text-gray-600"}`}>
                    {BADGE_LABELS[r.statusBadge] ?? r.statusBadge}
                  </span>
                </div>
              </div>
            ))}
            {/* Delta header */}
            <div className="text-center">
              <p className="text-xs text-gray-400">Δ B − A</p>
              <DeltaBadge delta={runB.memoConfidence - runA.memoConfidence} />
            </div>
          </div>

          {/* Stage averages */}
          <div className="grid grid-cols-[1fr_80px_1fr] gap-4">
            {["stage1Avg", "stage2Avg"].map((field) => {
              const label = field === "stage1Avg" ? "Stage 1 Avg" : "Stage 2 Avg";
              const vA = (runA as Record<string, unknown>)[field] as number;
              const vB = (runB as Record<string, unknown>)[field] as number;
              return (
                <div key={field} className="grid grid-cols-[1fr_80px_1fr] col-span-3 gap-4 items-center">
                  <div className={`text-sm font-semibold text-center ${scoreColor(vA)}`}>{vA.toFixed(2)}</div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">{label}</p>
                    <DeltaBadge delta={vB - vA} />
                  </div>
                  <div className={`text-sm font-semibold text-center ${scoreColor(vB)}`}>{vB.toFixed(2)}</div>
                </div>
              );
            })}
          </div>

          {/* Per-dimension table */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {/* Stage 1 */}
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Stage 1 — Solution Validity</p>
            </div>
            {STAGE_1_KEYS.map((k) => {
              const sA = score(runA, k);
              const sB = score(runB, k);
              const delta = sA != null && sB != null ? sB - sA : null;
              const name = PILLAR_EXPLANATIONS[k]?.name ?? k;
              return (
                <div key={k} className="grid grid-cols-[1fr_80px_1fr] items-center px-4 py-2.5 border-b border-gray-50 last:border-0">
                  <div className={`text-sm font-bold text-right ${scoreColor(sA)}`}>
                    {sA != null ? sA.toFixed(2) : "—"}
                  </div>
                  <div className="text-center px-2">
                    <p className="text-xs font-mono text-gray-400">{k}</p>
                    <p className="text-xs text-gray-500 truncate">{name}</p>
                    {delta != null && <DeltaBadge delta={delta} />}
                  </div>
                  <div className={`text-sm font-bold ${scoreColor(sB)}`}>
                    {sB != null ? sB.toFixed(2) : "—"}
                  </div>
                </div>
              );
            })}

            {/* Stage 2 */}
            <div className="px-4 py-2 bg-gray-50 border-t border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Stage 2 — Output Quality</p>
            </div>
            {STAGE_2_KEYS.map((k) => {
              const sA = score(runA, k);
              const sB = score(runB, k);
              const delta = sA != null && sB != null ? sB - sA : null;
              const name = PILLAR_EXPLANATIONS[k]?.name ?? k;
              return (
                <div key={k} className="grid grid-cols-[1fr_80px_1fr] items-center px-4 py-2.5 border-b border-gray-50 last:border-0">
                  <div className={`text-sm font-bold text-right ${scoreColor(sA)}`}>
                    {sA != null ? sA.toFixed(2) : "—"}
                  </div>
                  <div className="text-center px-2">
                    <p className="text-xs font-mono text-gray-400">{k}</p>
                    <p className="text-xs text-gray-500 truncate">{name}</p>
                    {delta != null && <DeltaBadge delta={delta} />}
                  </div>
                  <div className={`text-sm font-bold ${scoreColor(sB)}`}>
                    {sB != null ? sB.toFixed(2) : "—"}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 text-xs text-gray-400 justify-center">
            <Link href={`/scorecard/${aId}`} className="hover:text-brand-orange">Open Run A →</Link>
            <span>·</span>
            <Link href={`/scorecard/${bId}`} className="hover:text-brand-orange">Open Run B →</Link>
            <span>·</span>
            <Link href="/history" className="hover:text-brand-orange">Back to History</Link>
          </div>
        </div>
      </main>
    </>
  );
}
