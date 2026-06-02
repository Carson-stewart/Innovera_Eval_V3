import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import type { ApprovedRisk } from "@/lib/prompts/types";

interface ScoreRequestBody {
  memoId: number;
  framingId: number;
  typology: string;
  approvedRisks: ApprovedRisk[];
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: ScoreRequestBody;

  try {
    body = (await req.json()) as ScoreRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { memoId, framingId, typology, approvedRisks } = body;

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

  const { ids } = await inngest.send({
    name: "memo/score.requested",
    data: {
      memoId,
      framingId,
      typology,
      approvedRisks,
    },
  });

  return NextResponse.json({ eventId: ids[0] ?? null });
}
