import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updateRatings, ELO_BASE_RATING } from "@/lib/elo/rating";

interface CompareBody {
  memoAId: number;
  memoBId: number;
  winner: "A" | "B" | "TIE";
  margin: "CLEAR" | "MODERATE" | "SLIGHT" | "AMBIGUOUS";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reasoning?: string;
  humanOverride?: boolean;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: CompareBody;
  try {
    body = (await req.json()) as CompareBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { memoAId, memoBId, winner, margin, confidence, reasoning, humanOverride = false } = body;

  if (
    typeof memoAId !== "number" ||
    typeof memoBId !== "number" ||
    !["A", "B", "TIE"].includes(winner) ||
    !["CLEAR", "MODERATE", "SLIGHT", "AMBIGUOUS"].includes(margin) ||
    !["HIGH", "MEDIUM", "LOW"].includes(confidence)
  ) {
    return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
  }

  if (memoAId === memoBId) {
    return NextResponse.json({ error: "Cannot compare a memo with itself" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get or create EloRecord for both memos
      const [recA, recB] = await Promise.all([
        tx.eloRecord.upsert({
          where: { memoId: memoAId },
          create: { memoId: memoAId, rating: ELO_BASE_RATING, comparisonCount: 0 },
          update: {},
        }),
        tx.eloRecord.upsert({
          where: { memoId: memoBId },
          create: { memoId: memoBId, rating: ELO_BASE_RATING, comparisonCount: 0 },
          update: {},
        }),
      ]);

      // Compute new ratings
      const [newA, newB] = updateRatings(
        recA.rating, recA.comparisonCount,
        recB.rating, recB.comparisonCount,
        winner,
      );

      // Write the comparison row
      const comparison = await tx.eloComparison.create({
        data: {
          memoAId,
          memoBId,
          winner: winner as never,
          margin: margin as never,
          confidence: confidence as never,
          humanOverride,
          reasoning: reasoning ?? null,
        },
      });

      // Update both EloRecords
      const [updatedA, updatedB] = await Promise.all([
        tx.eloRecord.update({
          where: { memoId: memoAId },
          data: { rating: newA, comparisonCount: { increment: 1 } },
        }),
        tx.eloRecord.update({
          where: { memoId: memoBId },
          data: { rating: newB, comparisonCount: { increment: 1 } },
        }),
      ]);

      return { comparison, ratingA: updatedA.rating, ratingB: updatedB.rating };
    });

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
