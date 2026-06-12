import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { inngest } from "@/inngest/client";

/**
 * D3 — k-run verification scoring.
 *
 * POST { runId } re-scores the anchor run's memo+framing twice more through
 * the normal pipeline, carrying over the anchor's Risk Gate decisions
 * verbatim. New runs are stamped verificationGroupId = anchor id; the anchor
 * row itself is never modified. The C3 findings cache pins P1 across the
 * group, so the resulting spread measures the other pillars' variance.
 *
 * Token cost is real (~2 full scoring pipelines) — the UI confirms before
 * calling this; the API itself is also explicit in its response.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { runId?: number };
  try {
    body = (await req.json()) as { runId?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const runId = body.runId;
  if (typeof runId !== "number") {
    return NextResponse.json({ error: "Missing required field: runId" }, { status: 400 });
  }

  const run = await prisma.scoringRun.findUnique({
    where: { id: runId },
    include: {
      memo: { select: { id: true, typology: true } },
      confirmedRisks: true,
    },
  });
  if (!run) return NextResponse.json({ error: `Run ${runId} not found` }, { status: 404 });

  if (run.verificationGroupId !== null) {
    return NextResponse.json(
      { error: `Run ${runId} is itself a verification run (group ${run.verificationGroupId}). Verify from the anchor run instead.` },
      { status: 400 }
    );
  }

  if (run.framingId === null) {
    return NextResponse.json(
      {
        error:
          `Run ${runId} has no durable framing link (framingId is null — pre-2026-06-10 runs ` +
          `had ephemeral links). Verification needs the exact original framing; re-score the ` +
          `memo through the normal flow instead.`,
      },
      { status: 400 }
    );
  }

  // Carry the anchor's Risk Gate decisions over verbatim (approved AND
  // rejected — the scoring engine consumes only approved ones, as always).
  const approvedRisks = run.confirmedRisks.map((r) => ({
    statement: r.statement,
    classification: String(r.classification),
    source: String(r.source),
    severity: String(r.severity),
    approved: r.approved,
  }));

  const events = [1, 2].map((i) => ({
    name: "memo/score.requested" as const,
    data: {
      memoId: run.memo.id,
      framingId: run.framingId,
      typology: String(run.memo.typology),
      approvedRisks,
      // Anchor had zero risk rows only if it was itself a gate-bypass run —
      // carrying that over requires the explicit flag (and self-labels).
      allowEmptyRisks: approvedRisks.length === 0,
      verificationGroupId: runId,
      verificationIndex: i,
    },
  }));

  const { ids } = await inngest.send(events);

  return NextResponse.json({
    queued: ids.length,
    eventIds: ids,
    note: "2 verification runs queued (full scoring pipelines — token cost applies). They will appear in the group strip when Inngest completes them.",
  });
}
