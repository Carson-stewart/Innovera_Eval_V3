import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import type { ApprovedRisk } from "@/lib/prompts/types";

interface ScoreRequestBody {
  memoId: number;
  framingId: number;
  typology: string;
  approvedRisks: ApprovedRisk[];
  /** Explicit opt-in for runs that skip the Risk Gate (measurement/verification
   *  tooling). Such runs are stamped "risk gate bypassed" in dataNote at creation
   *  so they are self-labeling. The normal UI always sends 5 decided cards. */
  allowEmptyRisks?: boolean;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: ScoreRequestBody;

  try {
    body = (await req.json()) as ScoreRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { memoId, framingId, typology, approvedRisks, allowEmptyRisks } = body;

  if (
    typeof memoId !== "number" ||
    typeof framingId !== "number" ||
    typeof typology !== "string" ||
    !Array.isArray(approvedRisks)
  ) {
    return NextResponse.json(
      { error: "Missing required fields: memoId, framingId, typology, approvedRisks" },
      { status: 400 }
    );
  }

  if (approvedRisks.length === 0 && allowEmptyRisks !== true) {
    return NextResponse.json(
      {
        error:
          "approvedRisks is empty: scoring without the Risk Gate produces a run with no " +
          "risk data (zero ConfirmedRisk rows). If this is an intentional measurement/" +
          "verification run, pass allowEmptyRisks: true — the run will be stamped " +
          "'risk gate bypassed' in its dataNote.",
      },
      { status: 400 }
    );
  }

  const { ids } = await inngest.send({
    name: "memo/score.requested",
    data: {
      memoId,
      framingId,
      typology,
      approvedRisks,
      allowEmptyRisks: allowEmptyRisks === true,
    },
  });

  return NextResponse.json({ eventId: ids[0] ?? null });
}
