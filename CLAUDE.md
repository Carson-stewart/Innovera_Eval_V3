# Innovera Eval V3 — Project Rules

## What this is
A collaborative memo evaluation platform. Two modules:
- Memo Evaluator (primary): Confidence Erosion scoring across 13 dimensions, Risk Review Gate, Pairwise ELO.
- Decision Framing Sanity Checker (carry-over): multi-model framing validation.

## Non-negotiable architecture rules
1. Stage 1 (Solution Validity, 8 pillars) and Stage 2 (Output Quality, 5 dimensions) are NEVER combined into one number. They are reported separately. The ship gate may consult BOTH profiles (since V3 v1.1 a Stage 2 dimension ≤ 2.0 holds a would-be Ready-to-Ship at Needs Work) — that is a gate condition, not a combination; no formula ever merges the two scores into one number.
2. Confidence Erosion: every memo starts at 100; quality issues erode it. Memo Confidence = 100 minus pillar erosion, rescaled over the scored pillars when a pillar is not-scored (V3 v1.1 — an unscored pillar neither erodes nor counts as a perfect 5).
3. Decision Confidence in v1.0 = equal to Memo Confidence. The Risk Multiplier is held at 1.0 (Critical Risk Suppressor deferred to v1.5). Show it as a quiet placeholder, never a co-equal hero number.
4. Traceability is one-directional: the agent measures and classifies; the server computes scores from those classifications. NEVER reverse-engineer a classification to hit a target score.
5. The framing document is sent as the FIRST input in every LLM scoring call, before memo content.
6. Each memo is scored in isolation — no cross-memo contamination of absolute scores.

## v1.0 scope guards (do NOT build these in v1.0)
- No active Risk Multiplier / Critical Risk Suppressor (held at 1.0).
- No Risk Analysis tab on the scorecard.
- No Effective Penalty / Risk Erosion Summary panel.
- No Pillar 7 deferral — Pillar 7 IS active in v1.0, benchmark-library-backed.

## Design language (hard requirement)
- White / black / grey base, single orange accent (Innovera "A").
- Soft cards, generous spacing, one clean font. Status colors (green/amber/red) only on scores and alerts.
- Shared shell on every page: left sidebar (active item orange) + top bar + main area.

## Safety rules for destructive actions
- Every delete is two-step: action -> confirmation dialog ("cannot be undone") -> confirm. No one-click deletes anywhere.

## Stack
Next.js 14 App Router, TypeScript, Prisma, PostgreSQL 17, Tailwind + shadcn/ui, Inngest (port 8288), dev server on port 3000, OpenRouter for LLM calls.

## Dev stack (process discipline — incident-derived, 2026-06-11)
- **Exactly one dev server, always on port 3000.** Never start a second dev-server background task — stop the existing one first. Port kills must take the whole process tree (`taskkill /T`); killing only the listener leaves a `next dev` parent that respawns a worker on 3001.
- **Any restart after Prisma schema work goes through `npm run dev:clean`** (kills 3000 tree, removes `.next`, starts one server). `prisma generate` against a running dev server corrupts the `.next` webpack cache (stale vendor chunks → every route 404s, including `/api/inngest`, which silently kills in-flight Inngest scoring runs). `npm run db:sync` chains generate → db push → dev:clean.
- **One watcher at a time.** Watchers and pre-fire probes gate on `npm run stack:health` (one 3000 listener, `/api/inngest` 200, both functions registered, `.next/server` present) instead of ad-hoc curls.
