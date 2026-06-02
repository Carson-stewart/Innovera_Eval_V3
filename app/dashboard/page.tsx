import { TopBar } from "@/components/shell/TopBar";
import { prisma } from "@/lib/db";
import { DashboardClient } from "./DashboardClient";
import type {
  SummaryCards,
  RecentMemo,
  AlertItem,
  RecentCheck,
  EloEntry,
} from "./DashboardClient";

export default async function DashboardPage() {
  // ─── Memo data: latest run per memo ──────────────────────────────────────────
  // Load every memo with its single most-recent ScoringRun.
  // All card counts, recent activity, and alerts compute over THIS set —
  // so re-scoring the same memo never inflates the counts.
  const memosWithRuns = await prisma.memo.findMany({
    select: {
      id: true,
      name: true,
      typology: true,
      scoringRuns: {
        take: 1,
        orderBy: { scoredAt: "desc" },
        select: {
          id: true,
          memoConfidence: true,
          statusBadge: true,
          scoredAt: true,
        },
      },
    },
  });

  // Keep only memos that have been scored at least once
  const scoredMemos = memosWithRuns
    .filter((m) => m.scoringRuns.length > 0)
    .map((m) => ({
      memoId: m.id,
      memoName: m.name,
      typology: String(m.typology),
      runId: m.scoringRuns[0].id,
      memoConfidence: m.scoringRuns[0].memoConfidence,
      statusBadge: m.scoringRuns[0].statusBadge,
      scoredAt: m.scoringRuns[0].scoredAt.toISOString(),
    }));

  // Summary aggregates — computed server-side in JS over latest-run-per-memo
  const totalMemos = scoredMemos.length;
  const avgConfidence =
    totalMemos > 0
      ? scoredMemos.reduce((s, m) => s + m.memoConfidence, 0) / totalMemos
      : null;
  const readyToShip = scoredMemos.filter(
    (m) => m.statusBadge === "READY_TO_SHIP"
  ).length;
  const needsWork = scoredMemos.filter(
    (m) => m.statusBadge === "NEEDS_WORK"
  ).length;
  const majorRework = scoredMemos.filter(
    (m) => m.statusBadge === "MAJOR_REWORK"
  ).length;

  // Recent activity: sorted by latest-run date, most recent first
  const recentMemos: RecentMemo[] = [...scoredMemos]
    .sort((a, b) => new Date(b.scoredAt).getTime() - new Date(a.scoredAt).getTime())
    .slice(0, 5)
    .map((m) => ({ ...m }));

  // Memo alerts: MAJOR_REWORK or NEEDS_WORK, lowest confidence first
  const memoAlerts: AlertItem[] = scoredMemos
    .filter(
      (m) =>
        m.statusBadge === "MAJOR_REWORK" || m.statusBadge === "NEEDS_WORK"
    )
    .sort((a, b) => a.memoConfidence - b.memoConfidence)
    .slice(0, 4)
    .map((m) => ({
      type: "memo" as const,
      id: m.runId,
      name: m.memoName,
      badge: m.statusBadge,
      score: m.memoConfidence,
      date: m.scoredAt,
      href: `/scorecard/${m.runId}`,
    }));

  // ─── Framing data: latest check per framing ──────────────────────────────────
  const framingsWithChecks = await prisma.framing.findMany({
    select: {
      id: true,
      name: true,
      sanityChecks: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          verdict: true,
          passCount: true,
          failCount: true,
          typology: true,
          typologyConfidence: true,
          createdAt: true,
        },
      },
    },
  });

  const checkedFramings = framingsWithChecks
    .filter((f) => f.sanityChecks.length > 0)
    .map((f) => ({
      framingId: f.id,
      framingName: f.name,
      check: f.sanityChecks[0],
    }));

  const totalFramingsChecked = checkedFramings.length;
  const framingsReady = checkedFramings.filter(
    (f) => f.check.verdict === "READY_FOR_DELIVERY"
  ).length;
  const framingsAttention = checkedFramings.filter(
    (f) =>
      f.check.verdict === "MAJOR_REWORK_NEEDED" ||
      f.check.verdict === "REVISIONS_REQUIRED"
  ).length;

  // Recent sanity checks
  const recentChecks: RecentCheck[] = [...checkedFramings]
    .sort(
      (a, b) =>
        new Date(b.check.createdAt).getTime() -
        new Date(a.check.createdAt).getTime()
    )
    .slice(0, 4)
    .map((f) => ({
      checkId: f.check.id,
      framingName: f.framingName,
      verdict: f.check.verdict,
      typology: f.check.typology,
      passCount: f.check.passCount,
      failCount: f.check.failCount,
      createdAt: f.check.createdAt.toISOString(),
    }));

  // Framing alerts
  const framingAlerts: AlertItem[] = checkedFramings
    .filter(
      (f) =>
        f.check.verdict === "MAJOR_REWORK_NEEDED" ||
        f.check.verdict === "REVISIONS_REQUIRED"
    )
    .sort(
      (a, b) =>
        new Date(b.check.createdAt).getTime() -
        new Date(a.check.createdAt).getTime()
    )
    .slice(0, 4)
    .map((f) => ({
      type: "framing" as const,
      id: f.check.id,
      name: f.framingName,
      badge: f.check.verdict,
      score: null,
      date: f.check.createdAt.toISOString(),
      href: `/sanity-check/${f.check.id}`,
    }));

  // ─── ELO leaderboard ─────────────────────────────────────────────────────────
  const eloTop = await prisma.eloRecord.findMany({
    take: 5,
    orderBy: { rating: "desc" },
    select: {
      memoId: true,
      rating: true,
      comparisonCount: true,
      memo: {
        select: {
          name: true,
          scoringRuns: {
            take: 1,
            orderBy: { scoredAt: "desc" },
            select: { id: true },
          },
        },
      },
    },
  });

  const summary: SummaryCards = {
    totalMemos,
    avgConfidence,
    readyToShip,
    needsWork,
    majorRework,
    totalFramingsChecked,
    framingsReady,
    framingsAttention,
  };

  const leaderboard: EloEntry[] = eloTop.map((e) => ({
    memoId: e.memoId,
    memoName: e.memo.name,
    rating: e.rating,
    comparisonCount: e.comparisonCount,
    latestRunId: e.memo.scoringRuns[0]?.id ?? null,
  }));

  return (
    <>
      <TopBar title="Dashboard" />
      <DashboardClient
        summary={summary}
        recentMemos={recentMemos}
        recentChecks={recentChecks}
        alertItems={[...memoAlerts, ...framingAlerts].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )}
        eloLeaderboard={leaderboard}
      />
    </>
  );
}
