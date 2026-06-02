import { TopBar } from "@/components/shell/TopBar";
import { prisma } from "@/lib/db";
import { HistoryClient, type HistoryRun } from "./HistoryClient";
import { replayProgression } from "@/lib/elo/rating";

export default async function HistoryPage() {
  // Fetch all runs with memo + ELO
  const rawRuns = await prisma.scoringRun.findMany({
    select: {
      id: true,
      memoId: true,
      rubricVersion: true,
      memoConfidence: true,
      statusBadge: true,
      stage1Avg: true,
      stage2Avg: true,
      scoredAt: true,
      memo: {
        select: {
          id: true,
          name: true,
          typology: true,
          eloRecord: { select: { rating: true, comparisonCount: true } },
        },
      },
    },
    orderBy: { scoredAt: "desc" },
  });

  const runs: HistoryRun[] = rawRuns.map((r) => ({
    id: r.id,
    memoId: r.memoId,
    rubricVersion: r.rubricVersion,
    memoConfidence: r.memoConfidence,
    statusBadge: r.statusBadge,
    stage1Avg: r.stage1Avg,
    stage2Avg: r.stage2Avg,
    scoredAt: r.scoredAt.toISOString(),
    memo: {
      id: r.memo.id,
      name: r.memo.name,
      typology: String(r.memo.typology),
    },
    eloRating: r.memo.eloRecord?.rating ?? null,
    eloCount: r.memo.eloRecord?.comparisonCount ?? 0,
  }));

  // ELO progression: replay all ELO comparisons to build a time-series
  const allComparisons = await prisma.eloComparison.findMany({
    orderBy: { comparedAt: "asc" },
    select: { memoAId: true, memoBId: true, winner: true, comparedAt: true },
  });

  // Build a global ELO progression using any memo as the "focal" memo
  // For the history overview, track the highest-rated memo's progression
  const memoIds = Array.from(new Set(rawRuns.map((r) => r.memoId)));
  const topMemoId = memoIds[0] ?? null;
  const eloPoints =
    topMemoId != null
      ? replayProgression(
          allComparisons.map((c) => ({
            memoAId: c.memoAId,
            memoBId: c.memoBId,
            winner: String(c.winner),
            comparedAt: c.comparedAt,
          })),
          topMemoId,
        ).map((p) => ({ ...p, date: p.date === "start" ? runs[runs.length - 1]?.scoredAt ?? new Date().toISOString() : p.date }))
      : [];

  // Distinct rubric versions for the filter dropdown
  const rubricVersions = Array.from(new Set(rawRuns.map((r) => r.rubricVersion)));

  return (
    <>
      <TopBar title="History" />
      <HistoryClient
        initialRuns={runs}
        eloPoints={eloPoints}
        rubricVersions={rubricVersions}
      />
    </>
  );
}
