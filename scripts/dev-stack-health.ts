/**
 * scripts/dev-stack-health.ts — dev-stack health gate.
 *
 * Checks, in order:
 *   1. exactly one process LISTENing on port 3000
 *   2. GET http://localhost:3000/api/inngest returns 200
 *   3. both Inngest functions registered (function_count === 2)
 *   4. .next dev build directory present (".next/server" readable)
 *
 * Exits 0 when all pass; otherwise exits nonzero printing a NAMED failure.
 * Watchers and pre-fire probes call this instead of ad-hoc curls.
 *
 * Usage: npx tsx scripts/dev-stack-health.ts
 */
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const FAIL = (name: string, detail: string): never => {
  console.error(`HEALTH FAIL [${name}] ${detail}`);
  process.exit(1);
};

async function main() {
  // 1. exactly one listener on 3000
  let pids: string[] = [];
  try {
    const out = execSync("netstat -ano -p tcp", { encoding: "utf8" });
    pids = Array.from(
      new Set(
        out
          .split(/\r?\n/)
          .filter((l) => /LISTENING/.test(l) && /[:.]3000\s/.test(l))
          .map((l) => l.trim().split(/\s+/).pop() as string)
      )
    );
  } catch (e) {
    FAIL("NETSTAT_UNAVAILABLE", String(e));
  }
  if (pids.length === 0) FAIL("PORT_3000_NO_LISTENER", "no process is listening on 3000 — start the dev server (npm run dev:clean)");
  if (pids.length > 1) FAIL("PORT_3000_MULTIPLE_LISTENERS", `PIDs ${pids.join(", ")} — kill the extras (npm run dev:clean)`);

  // 2 + 3. inngest route healthy with both functions
  let res: Response;
  try {
    res = await fetch("http://localhost:3000/api/inngest", { signal: AbortSignal.timeout(5000) });
  } catch (e) {
    return FAIL("ROUTE_UNREACHABLE", `GET /api/inngest threw: ${String(e)}`);
  }
  if (res.status !== 200) FAIL("ROUTE_NOT_200", `GET /api/inngest returned ${res.status} — stale/corrupted .next build? Run npm run dev:clean`);
  const body = (await res.json()) as { function_count?: number };
  if (body.function_count !== 2) FAIL("FUNCTIONS_MISSING", `function_count=${body.function_count}, expected 2 (scoreMemo + sanityCheck)`);

  // 4. dev build dir sanity
  const buildDir = path.join(__dirname, "..", ".next", "server");
  if (!fs.existsSync(buildDir)) FAIL("BUILD_DIR_MISSING", ".next/server not found — dev server has no build (or .next was cleared while it ran)");

  console.log(`HEALTH OK — one listener on 3000 (PID ${pids[0]}), /api/inngest 200, 2 functions, .next/server present`);
}

main().catch((e) => FAIL("UNEXPECTED", String(e)));
