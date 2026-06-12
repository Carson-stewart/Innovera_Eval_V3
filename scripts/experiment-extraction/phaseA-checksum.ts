/** READ-ONLY: checksums score-relevant tables for before/after identity comparison (Phase A). */
import "dotenv/config";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../lib/generated/prisma/client";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as ConstructorParameters<typeof PrismaClient>[0]);

async function main() {
  const out: Record<string, unknown> = {};
  const dims = await prisma.dimensionScore.findMany({ orderBy: { id: "asc" } });
  const gaps = await prisma.gap.findMany({ orderBy: { id: "asc" } });
  const edits = await prisma.edit.findMany({ orderBy: { id: "asc" } });
  const risks = await prisma.confirmedRisk.findMany({ orderBy: { id: "asc" } });
  const runs = await prisma.scoringRun.findMany({
    orderBy: { id: "asc" },
    select: { id: true, memoConfidence: true, decisionConfidence: true, statusBadge: true, stage1Avg: true, stage2Avg: true, riskMultiplier: true, rubricVersion: true, scoredAt: true, dataNote: true, includeInAnalysis: true },
  });
  const h = (x: unknown) => crypto.createHash("md5").update(JSON.stringify(x)).digest("hex");
  out.counts = { dimensionScore: dims.length, gap: gaps.length, edit: edits.length, confirmedRisk: risks.length, scoringRun: runs.length };
  out.checksums = { dimensionScore: h(dims), gap: h(gaps), edit: h(edits), confirmedRisk: h(risks), scoringRunCore: h(runs) };
  out.runCore = runs;
  fs.writeFileSync(process.argv[2] ?? "baseline.json", JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out.counts), "\n", JSON.stringify(out.checksums));
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
