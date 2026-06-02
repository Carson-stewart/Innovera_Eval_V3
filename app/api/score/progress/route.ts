import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const INNGEST_BASE_URL = process.env.INNGEST_BASE_URL ?? "http://localhost:8288";

interface StepStatus {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
}

interface ProgressResponse {
  status: "running" | "completed" | "failed";
  steps: StepStatus[];
  scoringRunId?: number;
}

interface InngestRun {
  run_id?: string;
  status?: string;
  output?: unknown;
}

interface InngestStep {
  display_name?: string;
  name?: string;
  status?: string;
}

interface InngestRunDetail {
  status?: string;
  output?: unknown;
  steps?: InngestStep[];
}

function mapRunStatus(raw: string | undefined): "running" | "completed" | "failed" {
  if (!raw) return "running";
  const s = raw.toLowerCase();
  if (s === "completed") return "completed";
  if (s === "failed" || s === "cancelled") return "failed";
  return "running";
}

function mapStepStatus(raw: string | undefined): "pending" | "running" | "completed" | "failed" {
  if (!raw) return "pending";
  const s = raw.toLowerCase();
  if (s === "completed") return "completed";
  if (s === "failed") return "failed";
  if (s === "running") return "running";
  return "pending";
}

function parseOutput(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
  }
  return null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const eventId = req.nextUrl.searchParams.get("eventId");
  const memoIdParam = req.nextUrl.searchParams.get("memoId");
  const memoId = memoIdParam ? parseInt(memoIdParam, 10) : null;

  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  try {
    // Step 1: get runs for this event.
    // Inngest Dev Server wraps list responses in { data: [...] }, not { runs: [...] }.
    const eventRes = await fetch(`${INNGEST_BASE_URL}/v1/events/${eventId}/runs`, {
      headers: { Accept: "application/json" },
    });

    if (!eventRes.ok) {
      return dbFallback(memoId);
    }

    const eventData = (await eventRes.json()) as Record<string, unknown>;
    // Accept both { data: [...] } (Dev Server) and { runs: [...] } shapes
    const runs = (eventData.data ?? eventData.runs ?? []) as InngestRun[];
    const firstRun = runs[0];

    if (!firstRun?.run_id) {
      return dbFallback(memoId);
    }

    const runId = firstRun.run_id;

    // Step 2: get run detail.
    // Dev Server wraps in { data: { ... } }; handle both flat and wrapped shapes.
    const runRes = await fetch(`${INNGEST_BASE_URL}/v1/runs/${runId}`, {
      headers: { Accept: "application/json" },
    });

    if (!runRes.ok) {
      return dbFallback(memoId);
    }

    const runRaw = (await runRes.json()) as Record<string, unknown>;
    const runDetail = (
      runRaw.data && typeof runRaw.data === "object" ? runRaw.data : runRaw
    ) as InngestRunDetail;

    const runStatus = mapRunStatus(runDetail.status);
    const rawSteps: InngestStep[] = runDetail.steps ?? [];

    const steps: StepStatus[] = rawSteps.map((s, i) => ({
      id: s.name ?? `step-${i}`,
      name: s.display_name ?? s.name ?? `Step ${i}`,
      status: mapStepStatus(s.status),
    }));

    const response: ProgressResponse = { status: runStatus, steps };

    if (runStatus === "completed") {
      const output = parseOutput(runDetail.output);
      const rawId = output?.scoringRunId;
      const scoringRunId =
        typeof rawId === "number" ? rawId :
        typeof rawId === "string" ? parseInt(rawId, 10) :
        null;

      if (scoringRunId && !isNaN(scoringRunId)) {
        response.scoringRunId = scoringRunId;
      } else {
        // Fallback: find the most recent ScoringRun for this memo
        const fallback = await scoringRunForMemo(memoId);
        if (fallback) response.scoringRunId = fallback;
      }
    }

    return NextResponse.json(response);
  } catch {
    return dbFallback(memoId);
  }
}

async function scoringRunForMemo(memoId: number | null): Promise<number | null> {
  try {
    const where = memoId ? { memoId } : {};
    const run = await prisma.scoringRun.findFirst({
      where,
      orderBy: { scoredAt: "desc" },
      select: { id: true },
    });
    return run?.id ?? null;
  } catch {
    return null;
  }
}

async function dbFallback(memoId: number | null): Promise<NextResponse> {
  // If we can't reach Inngest at all, check whether a ScoringRun already exists for
  // this memo — which means the job completed even though the API is unreachable.
  if (memoId) {
    const id = await scoringRunForMemo(memoId);
    if (id) {
      return NextResponse.json<ProgressResponse>({
        status: "completed",
        steps: [],
        scoringRunId: id,
      });
    }
  }
  return NextResponse.json<ProgressResponse>({ status: "running", steps: [] });
}
