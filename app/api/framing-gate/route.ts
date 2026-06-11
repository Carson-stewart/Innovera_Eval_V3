import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CHECKS_BY_ID } from "@/lib/framing/checks";

/**
 * GET /api/framing-gate?framingId=N — read-only gate-verdict lookup for the
 * scoring flow (checker v1.2, T3). Returns the LATEST sanity-check result for
 * the framing, or { status: "not-run" }.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const framingId = parseInt(req.nextUrl.searchParams.get("framingId") ?? "", 10);
  if (isNaN(framingId)) {
    return NextResponse.json({ error: "framingId query param required" }, { status: 400 });
  }

  const latest = await prisma.sanityCheck.findFirst({
    where: { framingId },
    orderBy: { createdAt: "desc" },
    include: { sanityIssues: { select: { checkId: true } } },
  });

  if (!latest) {
    return NextResponse.json({ status: "not-run" as const });
  }

  const criticalCount = latest.sanityIssues.filter(
    (i) => CHECKS_BY_ID[i.checkId]?.severity === "Critical"
  ).length;

  return NextResponse.json({
    status: "run" as const,
    sanityCheckId: latest.id,
    // gateVerdict is null on pre-v1.2 results — the UI shows those as "not run
    // under the current checker" with a link to the old report.
    gateVerdict: latest.gateVerdict,
    checkerVersion: latest.checkerVersion,
    verdict: String(latest.verdict),
    criticalCount,
    createdAt: latest.createdAt.toISOString(),
  });
}
