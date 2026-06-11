/** READ-ONLY: E1 state probe — verification group 57 progress. */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../lib/generated/prisma/client";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as ConstructorParameters<typeof PrismaClient>[0]);
async function main() {
  const total = await prisma.scoringRun.count();
  const cacheRows = await prisma.p1FindingsCache.count();
  const group = await prisma.scoringRun.findMany({
    where: { verificationGroupId: 57 },
    orderBy: { id: "asc" },
    include: { dimensionScores: { where: { dimensionKey: "P1" } } },
  });
  console.log(`total runs: ${total} | cache rows: ${cacheRows} | group-57 verification runs: ${group.length}`);
  for (const r of group) {
    const log = (r.dimensionScores[0]?.traceabilityLog ?? {}) as Record<string, unknown>;
    console.log(`  run ${r.id}: rubric=${r.rubricVersion} readiness=${r.memoConfidence.toFixed(2)} badge=${r.statusBadge} ` +
      `scoredPillars=${r.scoredPillarCount} cache=${log.p1_findings_cache} majors=${(r.dimensionScores[0]?.subScores as Record<string, unknown>)?.majorReconciliations} dataNote=${JSON.stringify(r.dataNote)}`);
  }
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
