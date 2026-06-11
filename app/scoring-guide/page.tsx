"use client";

import { useState } from "react";
import { TopBar } from "@/components/shell/TopBar";
import {
  PILLAR_EXPLANATIONS,
  STAGE_1_KEYS,
  STAGE_2_KEYS,
} from "@/lib/pillars/explanations";
import {
  PILLAR_GUIDE_DETAILS,
  type ScoreMeaning,
} from "@/lib/pillars/guide-details";

// ─── TOC definition ───────────────────────────────────────────────────────────

const TOC_ITEMS = [
  { id: "confidence-erosion",  label: "Readiness Erosion" },
  { id: "scoring-journey",     label: "Scoring Journey" },
  { id: "two-stages",          label: "The Two Stages" },
  { id: "how-scores-work",     label: "How Scores Work" },
  { id: "pillars",             label: "The 13 Pillars" },
  { id: "guardrails",          label: "Guardrails" },
  { id: "confidence-numbers",  label: "Readiness Numbers" },
  { id: "versions",            label: "Versions & ELO" },
];

// ─── Small reusable primitives ────────────────────────────────────────────────

function SectionAnchor({ id }: { id: string }) {
  // Invisible anchor slightly above the section so the sticky TOC doesn't obscure it
  return <div id={id} className="-mt-4 pt-4" aria-hidden />;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-semibold text-gray-900 mb-3">{children}</h2>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-gray-600 leading-relaxed">{children}</p>
  );
}

function FormulaChip({ formula }: { formula: string }) {
  return (
    <span className="inline-block font-mono text-xs bg-gray-100 text-gray-700 rounded px-2 py-1 leading-snug">
      {formula}
    </span>
  );
}

function MathTypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-block text-xs bg-white border border-gray-200 text-gray-500 rounded-full px-2 py-0.5">
      {type}
    </span>
  );
}

function StagePill({ stage }: { stage: "Stage 1" | "Stage 2" }) {
  return (
    <span className="inline-block text-xs font-semibold rounded-full px-2.5 py-0.5 bg-brand-orange-light text-brand-orange border border-brand-orange-ring">
      {stage}
    </span>
  );
}

function ScoreMeaningsTable({ meanings }: { meanings: ScoreMeaning[] }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
        What each score means
      </p>
      <div className="rounded-lg border border-gray-100 overflow-hidden">
        {[...meanings].sort((a, b) => b.score - a.score).map((m, i) => (
          <div
            key={m.score}
            className={`flex items-start gap-3 px-3 py-2 ${
              i < meanings.length - 1 ? "border-b border-gray-100" : ""
            }`}
          >
            <span className="shrink-0 w-5 text-right text-sm font-bold text-brand-orange">
              {m.score}
            </span>
            <span className="text-xs text-gray-600 leading-relaxed">{m.means}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IndependenceBlock({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
        Independent from
      </p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-gray-500 leading-relaxed pl-3 border-l-2 border-gray-200">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Pillar card ──────────────────────────────────────────────────────────────

function PillarCard({ pillarKey }: { pillarKey: string }) {
  const [open, setOpen] = useState(false);
  const exp = PILLAR_EXPLANATIONS[pillarKey];
  const guide = PILLAR_GUIDE_DETAILS[pillarKey];
  if (!exp || !guide) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* ── Header row — always visible ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange-ring rounded-xl"
        aria-expanded={open}
      >
        <div className="flex items-start gap-3 min-w-0">
          {/* Key badge */}
          <span className="shrink-0 mt-0.5 rounded bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">
            {pillarKey}
          </span>
          <div className="min-w-0">
            {/* Name + stage pill */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold text-sm text-gray-900">{exp.name}</span>
              <StagePill stage={exp.stage} />
            </div>
            {/* Gloss — from explanations.ts */}
            <p className="text-xs text-gray-500 leading-relaxed">{exp.gloss}</p>
          </div>
        </div>
        {/* Chevron */}
        <svg
          className={`shrink-0 mt-1 h-4 w-4 transition-transform duration-200 ${
            open ? "rotate-180 text-brand-orange" : "text-gray-400"
          }`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* ── Expanded body ── */}
      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100">

          {/* What it measures — detail from explanations.ts */}
          <div className="pt-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              What it measures
            </p>
            <p className="text-sm text-gray-600 leading-relaxed mb-2">{exp.detail}</p>
            <ul className="space-y-1">
              {guide.measures.map((m, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
                  <span className="mt-1.5 shrink-0 w-1 h-1 rounded-full bg-gray-400" aria-hidden />
                  {m}
                </li>
              ))}
            </ul>
          </div>

          {/* Formula block */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              How it&apos;s scored
            </p>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <FormulaChip formula={guide.formula} />
              <MathTypeBadge type={guide.mathType} />
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">{guide.formulaPlain}</p>
          </div>

          {/* Calculation logic */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Calculation logic
            </p>
            <p className="text-xs text-gray-600 leading-relaxed">{guide.calcLogic}</p>
          </div>

          {/* Score meanings table */}
          <ScoreMeaningsTable meanings={guide.scoreMeanings} />

          {/* Independence */}
          <IndependenceBlock items={guide.independentOf} />
        </div>
      )}
    </div>
  );
}

// ─── TOC sidebar ──────────────────────────────────────────────────────────────

function TableOfContents({ activeId }: { activeId: string }) {
  return (
    <nav aria-label="Page sections">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        On this page
      </p>
      <ul className="space-y-1">
        {TOC_ITEMS.map((item) => {
          const active = activeId === item.id;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`block text-sm py-1 px-2 rounded transition-colors ${
                  active
                    ? "text-brand-orange font-medium bg-brand-orange-light"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScoringGuidePage() {
  const [activeId] = useState("confidence-erosion");

  return (
    <>
      <TopBar title="Scoring Guide" />

      <div className="flex-1 flex min-h-0">

        {/* ── Sticky left TOC (desktop) ── */}
        <aside className="hidden lg:block w-52 shrink-0 sticky top-14 self-start h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-gray-100 px-4 py-6">
          <TableOfContents activeId={activeId} />
        </aside>

        {/* ── Main reading column ── */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[760px] mx-auto px-6 py-8 space-y-14">

            {/* ── Page header ──────────────────────────────────────────────── */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">How Scoring Works</h1>
              <p className="text-sm text-gray-500 leading-relaxed">
                A plain-language explanation of the Innovera Eval V3 framework — from the
                core idea to every formula, for memo authors and IC members.
              </p>
              {/* Mobile TOC */}
              <div className="lg:hidden mt-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
                <TableOfContents activeId={activeId} />
              </div>
            </div>

            {/* ── §1 Confidence Erosion ─────────────────────────────────────── */}
            <section aria-labelledby="h-confidence-erosion">
              <SectionAnchor id="confidence-erosion" />
              <SectionHeading>
                <span id="h-confidence-erosion">The Readiness Erosion Idea</span>
              </SectionHeading>
              <div className="space-y-3">
                <Prose>
                  Every memo starts at 100% readiness. It doesn&rsquo;t earn points — it starts
                  perfect and loses readiness wherever quality problems appear. The final score
                  tells you how much readiness survived, and the per-pillar breakdown tells you
                  exactly where it was lost.
                </Prose>
                <Prose>
                  A 5 out of 5 on a pillar doesn&rsquo;t mean &ldquo;excellent&rdquo; — it means
                  &ldquo;no problems found here, nothing eroded.&rdquo; This is a zero-defect
                  standard, not a gold-star one.
                </Prose>
              </div>
            </section>

            {/* ── §2 Scoring journey ────────────────────────────────────────── */}
            <section aria-labelledby="h-scoring-journey">
              <SectionAnchor id="scoring-journey" />
              <SectionHeading>
                <span id="h-scoring-journey">The Scoring Journey</span>
              </SectionHeading>
              <ol className="space-y-5">
                {[
                  {
                    n: "1",
                    title: "Risk Review Gate",
                    body: "Before scoring, the tool flags the top 5 critical risks in the memo. You approve or reject each one. This takes about 90 seconds and makes sure the scoring reflects risks a human has signed off on.",
                  },
                  {
                    n: "2",
                    title: "Absolute Scoring",
                    body: "The memo is scored across 13 dimensions, each producing a 1–5 score. The 8 Stage 1 pillars erode Memo Readiness — their erosions add up to the final number. The 5 Stage 2 dimensions form a separate Output Quality profile that is deliberately never combined with it.",
                  },
                  {
                    n: "3",
                    title: "Pairwise ELO",
                    body: "The memo is compared head-to-head against past memos on how useful it is for making a decision. This gives a relative rating that stays comparable even when the rubric changes. A human can verify or override the comparison.",
                  },
                ].map((step) => (
                  <li key={step.n} className="flex gap-4">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-brand-orange text-white text-sm font-bold flex items-center justify-center mt-0.5">
                      {step.n}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 mb-1">{step.title}</p>
                      <Prose>{step.body}</Prose>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {/* ── §3 Two stages ─────────────────────────────────────────────── */}
            <section aria-labelledby="h-two-stages">
              <SectionAnchor id="two-stages" />
              <SectionHeading>
                <span id="h-two-stages">The Two Stages</span>
              </SectionHeading>
              <div className="space-y-3">
                <Prose>
                  The 13 dimensions split into two stages that are deliberately never added into
                  one number.
                </Prose>
                <div className="grid sm:grid-cols-2 gap-4 mt-2">
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <StagePill stage="Stage 1" />
                      <span className="text-xs text-gray-500">8 pillars</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mb-1">Solution Validity</p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Is the underlying analysis sound? Does it answer the right question,
                      explore enough, use good evidence, and reach a well-built recommendation?
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <StagePill stage="Stage 2" />
                      <span className="text-xs text-gray-500">5 dimensions</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mb-1">Output Quality</p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Is it well-presented? Easy to read, well-formatted, written for an
                      executive, complete, and clearly actionable?
                    </p>
                  </div>
                </div>
                <Prose>
                  Keeping them apart is the whole point. A memo can have strong analysis but
                  poor presentation (needs polish), or — more dangerously — slick presentation
                  hiding weak analysis. Merging the two into a single score would hide exactly
                  the cases you most need to catch. Read them as a 2×2: weak analysis with
                  strong presentation is the most concerning quadrant.
                </Prose>
              </div>
            </section>

            {/* ── §4 How a 1–5 becomes confidence ──────────────────────────── */}
            <section aria-labelledby="h-how-scores-work">
              <SectionAnchor id="how-scores-work" />
              <SectionHeading>
                <span id="h-how-scores-work">How a 1–5 Score Becomes Readiness</span>
              </SectionHeading>
              <div className="space-y-3">
                <Prose>
                  Each pillar&rsquo;s 1–5 score maps to how much readiness it erodes:
                  5 erodes nothing, 4 a little, 3 a moderate amount, 2 a large amount, 1 the
                  maximum. The pillars combine their sub-scores in one of three ways, chosen to
                  fit what&rsquo;s being measured:
                </Prose>
                <ul className="space-y-3 mt-1">
                  {[
                    {
                      label: "Geometric mean",
                      pillars: "Pillars 2 and 4",
                      desc: "Used where being strong on one part can't make up for being weak on another — one low sub-score drags the whole pillar down. Used for balance-sensitive things like problem fit and coverage breadth.",
                    },
                    {
                      label: "Arithmetic mean",
                      pillars: "Pillars 5, 6, 7, 8 and all of Stage 2",
                      desc: "A straight average, used where the parts are genuinely independent quality axes.",
                    },
                    {
                      label: "Base-5 minus penalties",
                      pillars: "Pillars 1 and 3",
                      desc: "Start at a perfect 5 and subtract for each specific defect found. Used for absence-of-defects measures like internal consistency and structural completeness.",
                    },
                  ].map((row) => (
                    <li key={row.label} className="flex gap-3">
                      <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-brand-orange" aria-hidden />
                      <div>
                        <span className="text-sm font-semibold text-gray-900">{row.label}</span>
                        <span className="text-xs text-gray-400 ml-2">({row.pillars})</span>
                        <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{row.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* ── §5 The 13 pillars ─────────────────────────────────────────── */}
            <section aria-labelledby="h-pillars">
              <SectionAnchor id="pillars" />
              <SectionHeading>
                <span id="h-pillars">The 13 Pillars</span>
              </SectionHeading>
              <Prose>
                Each card below contains the full reference for that pillar: what it measures,
                how it&rsquo;s calculated, what each score means, and what it deliberately does
                not overlap with. Click a card to expand it.
              </Prose>

              {/* Stage 1 */}
              <div className="mt-6">
                <div className="flex items-center gap-3 mb-4">
                  <StagePill stage="Stage 1" />
                  <span className="text-sm font-semibold text-gray-700">Solution Validity</span>
                  <span className="text-xs text-gray-400">— 8 pillars</span>
                </div>
                <div className="space-y-3">
                  {STAGE_1_KEYS.map((k) => (
                    <PillarCard key={k} pillarKey={k} />
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="my-8 border-t border-gray-200" />

              {/* Stage 2 */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <StagePill stage="Stage 2" />
                  <span className="text-sm font-semibold text-gray-700">Output Quality</span>
                  <span className="text-xs text-gray-400">— 5 dimensions</span>
                </div>
                <div className="space-y-3">
                  {STAGE_2_KEYS.map((k) => (
                    <PillarCard key={k} pillarKey={k} />
                  ))}
                </div>
              </div>
            </section>

            {/* ── §6 Guardrails ─────────────────────────────────────────────── */}
            <section aria-labelledby="h-guardrails">
              <SectionAnchor id="guardrails" />
              <SectionHeading>
                <span id="h-guardrails">The Guardrails</span>
              </SectionHeading>
              <div className="space-y-3">
                <Prose>
                  Guardrails are rules the AI must follow so scores stay consistent and honest.
                  Five apply to every dimension:
                </Prose>
                <ul className="space-y-3">
                  {[
                    {
                      title: "No cross-memo contamination",
                      desc: "Each memo is scored entirely on its own, never compared to another mid-score.",
                    },
                    {
                      title: "Count before scoring",
                      desc: "The AI must count or identify what it found and state the count before assigning any sub-score.",
                    },
                    {
                      title: "Evidence from the memo only",
                      desc: "It scores what's actually written; it cannot invent supporting content. If something is absent, that absence is recorded, not filled in.",
                    },
                    {
                      title: "Rule-bound, not vibes",
                      desc: "It classifies against defined rules and vocabularies, not a general impression.",
                    },
                    {
                      title: "One-directional traceability",
                      desc: "The AI measures and classifies; the server computes the score from those classifications. It can never work backwards from a target score. This is also why the tool stores both what the server computed and what the AI reported, so any drift between them is visible.",
                    },
                  ].map((g, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <div>
                        <span className="text-sm font-semibold text-gray-900">{g.title}</span>
                        <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{g.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                  <Prose>
                    On top of these, each pillar has its own specific guardrails — for example,
                    Pillar 4 must score the &ldquo;interpretive alternatives&rdquo; facet from
                    what&rsquo;s actually written rather than defaulting to a known low value, and
                    Pillar 7 must declare its sparse-data approach before scoring and never
                    penalise a memo simply for containing few financial figures.
                  </Prose>
                </div>
              </div>
            </section>

            {/* ── §7 Confidence numbers + badge ─────────────────────────────── */}
            <section aria-labelledby="h-confidence-numbers">
              <SectionAnchor id="confidence-numbers" />
              <SectionHeading>
                <span id="h-confidence-numbers">The Two Readiness Numbers + Status Badge</span>
              </SectionHeading>
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-sm font-semibold text-gray-900 mb-1">Memo Readiness</p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    The headline number: 100 minus everything the pillars eroded. It reflects
                    what editors can control — the quality of the analysis and presentation.
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-900">Decision Readiness</p>
                    <span className="text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-2 py-0.5 font-medium">
                      Suppressor pending v1.5
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Memo Readiness adjusted for business risk. In v1.0, that risk adjustment is
                    held inactive, so Decision Readiness simply equals Memo Readiness. It is
                    shown as a quiet placeholder — intentionally not presented as a co-equal
                    headline number yet. When the Critical Risk Suppressor activates in v1.5, it
                    will discount readiness based on the severity of the approved risks from the
                    Risk Gate.
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-sm font-semibold text-gray-900 mb-1">Status Badge</p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Summarises the result at a glance — whether the memo is ready to ship, needs
                    work, or needs a major rework. The badge is derived from Memo Readiness and
                    the gap severity, not from a manual judgement.
                  </p>
                </div>
              </div>
            </section>

            {/* ── §8 Versions & ELO ─────────────────────────────────────────── */}
            <section aria-labelledby="h-versions">
              <SectionAnchor id="versions" />
              <SectionHeading>
                <span id="h-versions">A Note on Versions</span>
              </SectionHeading>
              <div className="space-y-3">
                <Prose>
                  The rubric is versioned. Because the meaning of a &ldquo;5&rdquo; can be
                  refined between versions, absolute scores from different rubric versions
                  aren&rsquo;t directly comparable — every scoring run is stamped with the rubric
                  version it used, and re-scoring under a new version creates a fresh run rather
                  than overwriting the old one.
                </Prose>
                <Prose>
                  The ELO rating is the exception: it&rsquo;s designed to stay comparable across
                  versions, which is why it exists alongside the absolute scores. Each memo starts
                  at 1500; the K-factor is 32 for the first 30 comparisons, then 16. ELO is
                  a relative measure — it tells you how a memo compares to others for decision
                  utility, independent of which rubric version scored it.
                </Prose>
              </div>
            </section>

            {/* Bottom padding */}
            <div className="pb-12" />
          </div>
        </main>
      </div>
    </>
  );
}
