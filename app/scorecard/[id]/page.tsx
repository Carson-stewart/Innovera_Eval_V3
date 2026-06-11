import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { ScorecardClient } from "./ScorecardClient";

interface Props {
  params: { id: string };
}

export default async function ScorecardPage({ params }: Props) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) notFound();

  const run = await prisma.scoringRun.findUnique({
    where: { id },
    include: {
      memo: {
        include: { eloRecord: true },
      },
      dimensionScores: { orderBy: { id: "asc" } },
      diagnostics: true,
      gaps: {
        orderBy: [
          { severity: "asc" },  // Prisma enum order: HIGH < LOW < MEDIUM alphabetically
          { id: "asc" },
        ],
      },
      edits: {
        orderBy: [
          { severity: "asc" },
          { id: "asc" },
        ],
      },
      confirmedRisks: true,
      redundancyAnalysis: true,  // Phase R1 — informational diagnostic
    },
  });

  if (!run) notFound();

  // Severity sort: HIGH first, then MEDIUM, then LOW
  const SEV_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const sortBySev = <T extends { severity: string }>(arr: T[]): T[] =>
    [...arr].sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9));

  const sorted = {
    ...run,
    gaps: sortBySev(run.gaps),
    edits: sortBySev(run.edits),
  };

  // D3: k-run verification group — the anchor run + all runs pointing at it.
  // Display-level grouping only; nothing is written here.
  const groupKey = run.verificationGroupId ?? run.id;
  const groupRuns = await prisma.scoringRun.findMany({
    where: { OR: [{ id: groupKey }, { verificationGroupId: groupKey }] },
    select: { id: true, memoConfidence: true, statusBadge: true, scoredAt: true },
    orderBy: { id: "asc" },
  });
  const verificationGroup =
    groupRuns.length >= 2
      ? groupRuns.map((r) => ({
          runId: r.id,
          memoConfidence: r.memoConfidence,
          statusBadge: String(r.statusBadge),
          scoredAt: r.scoredAt.toISOString(),
        }))
      : null;

  // JSON.parse(JSON.stringify()) serializes Dates → ISO strings and JsonValue → plain objects.
  // Safe for the server→client boundary.
  return <ScorecardClient run={JSON.parse(JSON.stringify(sorted))} verificationGroup={verificationGroup} />;
}
