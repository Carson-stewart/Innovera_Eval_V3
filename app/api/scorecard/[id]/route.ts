import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    // Delete children first (Prisma default is NoAction on FK constraints)
    await prisma.$transaction([
      prisma.diagnostic.deleteMany({ where: { scoringRunId: id } }),
      prisma.gap.deleteMany({ where: { scoringRunId: id } }),
      prisma.edit.deleteMany({ where: { scoringRunId: id } }),
      prisma.confirmedRisk.deleteMany({ where: { scoringRunId: id } }),
      prisma.dimensionScore.deleteMany({ where: { scoringRunId: id } }),
      prisma.scoringRun.delete({ where: { id } }),
    ]);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete scoring run" }, { status: 500 });
  }
}
