import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ELO_BASE_RATING } from "@/lib/elo/rating";

/** Returns all memos with their current ELO rating — used by the comparison picker. */
export async function GET(): Promise<NextResponse> {
  const memos = await prisma.memo.findMany({
    select: {
      id: true,
      name: true,
      typology: true,
      eloRecord: { select: { rating: true, comparisonCount: true } },
      scoringRuns: {
        select: { id: true, memoConfidence: true, statusBadge: true, scoredAt: true },
        orderBy: { scoredAt: "desc" },
        take: 1,
      },
    },
    orderBy: { id: "desc" },
  });

  return NextResponse.json(
    memos.map((m) => ({
      memoId: m.id,
      name: m.name,
      typology: m.typology,
      rating: m.eloRecord?.rating ?? ELO_BASE_RATING,
      comparisonCount: m.eloRecord?.comparisonCount ?? 0,
      latestRunId: m.scoringRuns[0]?.id ?? null,
      latestConfidence: m.scoringRuns[0]?.memoConfidence ?? null,
      latestBadge: m.scoringRuns[0]?.statusBadge ?? null,
    }))
  );
}
