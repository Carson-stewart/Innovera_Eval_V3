# E1 — Run-57 Verification Group: STATUS BLOCKED (credits)

**State as of 2026-06-11 (3rd firing attempt withheld).**

## Pre-fire gate results

- `npm run stack:health`: **PASS** — one listener on 3000, `/api/inngest` 200, both
  functions registered, `.next/server` present. The stack is ready.
- OpenRouter key status (free `/api/v1/auth/key` probe, no tokens spent):
  **limit $250.00, usage $430.61, remaining −$180.61** — the key is over its
  monthly limit. Firing would 402 on every Tier call, exactly like attempt 2.

Per the standing rules (402/credit = STOP-AND-REPORT, no retry loops), **E1 was not
fired.** This is the only blocker; everything else is staged.

## Attempt history

| # | When (UTC) | Outcome | Cause |
|---|---|---|---|
| 1 | 2026-06-11 13:46 | both runs died mid-Tier, nothing persisted | `.next` build corruption 404'd `/api/inngest` mid-execution (infra — since hardened: `dev:clean`/`db:sync`/`stack:health`) |
| 2 | 2026-06-11 14:06 | both runs FAILED after ~5 min of retries | OpenRouter 402 — key monthly limit exhausted |
| 3 | this session | **withheld** | key still at −$180.61 remaining |

Sunk tokens: attempt 1's partial Tier calls only; attempt 2 spent nothing (requests
rejected at the provider).

## To fire (after Carson raises the key's monthly limit)

1. `npm run stack:health` (must pass)
2. Re-check the key: usage < limit
3. `POST http://localhost:3000/api/verify-score {"runId": 57}`
4. Watch with `npx tsx scripts/engine-replay/e1-watch.ts` (route-health-guarded
   watcher pattern per CLAUDE.md; the persistent dev-stack health monitor is armed)

## Registered expectations to validate on completion (unchanged)

- Both runs FINALIZED, rubricVersion "V3 v1.1", `scorableChapterCount` populated;
  zero ConfirmedRisk rows carried over with `dataNote = "risk gate bypassed"`
  self-label (run 57 was a bypass anchor — its gate had no risk rows to carry).
- Cache: **registered prediction — cold-race miss/miss** (the two runs execute in
  parallel under the Inngest concurrency cap of 2, and the cache lookup happens
  after the Tier steps, so both likely miss before either stores; the second
  store hits the unique-violation guard). Record actual hit/miss per run from P1
  traceability, confirm the surviving P1FindingsCache row parses as well-formed
  JSON, note which run wrote last.
- Aggregate strip renders; record per-run readiness, **spread**, consensus badge.
  Label the spread "legacy/unpinned" if miss/miss, "pinned" if run 2 hit.
