// Reference facts for the Scoring Guide page — formulas, math types, score meanings,
// calculation logic, and independence notes.
//
// These are the NEW fields that belong only here. Names, glosses, and detail sentences
// live exclusively in lib/pillars/explanations.ts. The two files compose on the page
// but neither duplicates the other.
//
// All formulas and numbers are copied verbatim from the framework spec v1.0.

export type ScoreMeaning = { score: 5 | 4 | 3 | 2 | 1; means: string };

export type PillarGuideDetail = {
  key: string;
  mathType: "Geometric mean" | "Arithmetic mean" | "Base-5 minus penalties";
  formula: string;         // shown in a mono chip
  formulaPlain: string;    // one sentence, plain words
  measures: string[];      // the quantifiable sub-metrics
  calcLogic: string;       // how the measurements turn into the score
  scoreMeanings: ScoreMeaning[]; // what 5..1 mean for THIS pillar (erosion framing)
  independentOf: string[]; // each entry: "vs Pillar X — distinction in plain words"
};

export const PILLAR_GUIDE_DETAILS: Record<string, PillarGuideDetail> = {
  P1: {
    key: "P1",
    mathType: "Base-5 minus penalties",
    formula: "CI = 5 − penalties + tension_bonus  (clamped 1–5)",
    formulaPlain:
      "Start at a perfect 5 and subtract points for each contradiction or unreconciled number; add a small bonus if the memo openly acknowledges a real tension.",
    measures: [
      "Flat contradictions (two statements that directly conflict)",
      "Major reconciliation failures (the same number given differently)",
      "Minor gaps, definitional drift, reasoning gaps",
      "Acknowledged tensions (a credit, not a penalty)",
    ],
    calcLogic:
      "Each flat contradiction costs −2.0 (−3.0 if two or more). Each major reconciliation failure costs −1.0 (−2.0 if two or more). Each minor gap, drift, or reasoning gap costs −0.25. One acknowledged tension adds +0.5. The result is capped between 1 and 5.",
    scoreMeanings: [
      { score: 5, means: "No contradictions anywhere; every number reconciles." },
      { score: 4, means: "A minor gap or two, nothing that changes the conclusion." },
      { score: 3, means: "A reconciliation failure or several minor gaps." },
      { score: 2, means: "A flat contradiction, or many unresolved gaps." },
      { score: 1, means: "Multiple contradictions; the memo argues against itself." },
    ],
    independentOf: [
      "vs Pillar 7 — Coherence is about stated numbers that contradict; Pillar 7 is about numbers that don't scale realistically.",
      "vs D4 — Coherence checks the whole memo; D4's self-containment only checks whether the Executive Summary stands alone.",
    ],
  },

  P2: {
    key: "P2",
    mathType: "Geometric mean",
    formula: "PFI = geometric_mean(Fidelity, Gap-filling, Executability)",
    formulaPlain:
      "Combine three 1–5 scores using a geometric mean, which punishes imbalance — one weak score drags the whole pillar down.",
    measures: [
      "Fidelity — does the memo answer the framing's actual decision question?",
      "Gap-filling — does it address the specific blocking questions the framing raised?",
      "Executability — do the recommended actions carry Success / Kill / Timeframe detail?",
    ],
    calcLogic:
      "Each of the three parts is scored 1–5, then combined with a geometric mean so a single weak part (say, the memo answers a nearby question instead of the real one) holds the score down even if the other two are strong.",
    scoreMeanings: [
      { score: 5, means: "Answers exactly the decision asked, covers every blocking question, actions are executable." },
      { score: 4, means: "On-target with a small gap in one blocking question or action detail." },
      { score: 3, means: "Addresses the topic but misses some blocking questions, or actions lack gates." },
      { score: 2, means: "Drifts toward a nearby question, or leaves major framing questions unanswered." },
      { score: 1, means: "Answers a different question than the one framed." },
    ],
    independentOf: [
      "vs Pillar 3 — Pillar 2 is about content (did it answer the question); Pillar 3 is about structure (are the chapters present).",
      "vs Pillar 8 — Pillar 2 checks fidelity to the framing; Pillar 8 checks how well the recommendation itself is built.",
    ],
  },

  P3: {
    key: "P3",
    mathType: "Base-5 minus penalties",
    formula: "FI = 5 + bonuses − penalties  (clamped 1–5)",
    formulaPlain:
      "Start at 5 and subtract for missing or duplicated structural pieces; add small bonuses for going beyond the expected template.",
    measures: [
      "Expected chapters present vs missing (by memo typology)",
      "Missing sub-sections",
      "Duplicate headers",
      "Wrong template for the typology",
      "Bonus: typology refinement / useful additional chapters",
    ],
    calcLogic:
      "The expected chapter list comes from the declared typology. Each missing chapter costs −0.5, each missing sub-section −0.25, each duplicate header −0.25, a wrong template −0.5. A typology refinement adds +0.5; useful extra chapters add +0.25 to +0.5. Capped 1–5. The two non-scored sections (Financial Appendix and Six-T / Risk) are excluded from these penalties.",
    scoreMeanings: [
      { score: 5, means: "Every expected chapter present, no duplicates, right template." },
      { score: 4, means: "One minor structural omission." },
      { score: 3, means: "A missing chapter or a few missing sub-sections." },
      { score: 2, means: "Several missing chapters or a wrong template." },
      { score: 1, means: "Structure barely matches what the typology requires." },
    ],
    independentOf: [
      "vs Pillar 2 — Pillar 3 is structure (chapters present); Pillar 2 is content (right question answered). A memo can have every chapter yet answer the wrong question.",
      "vs D2 — Pillar 3 checks a chapter exists; D2 checks whether it's formatted clearly.",
    ],
  },

  P4: {
    key: "P4",
    mathType: "Geometric mean",
    formula: "CovI = geometric_mean(Options, Scenarios, Sensitivities, IA)",
    formulaPlain:
      "Combine four 1–5 breadth scores with a geometric mean, so being thorough on three but blind on the fourth still lowers the score.",
    measures: [
      "Options — were multiple paths compared?",
      "Scenarios — were best / worst / likely cases considered?",
      "Sensitivities — was it tested against changing key inputs?",
      "Interpretive Alternatives (IA) — were the obvious counterarguments examined?",
    ],
    calcLogic:
      "Each facet is scored 1–5 from the memo's explicit content and combined with a geometric mean. Known system behaviour: the IA facet tends to sit at a 1.5–2.0 floor across all memos — the guardrail requires scoring IA from what's actually written, never auto-assigning the floor.",
    scoreMeanings: [
      { score: 5, means: "Multiple options, full scenario range, sensitivity testing, counterarguments examined." },
      { score: 4, means: "Strong breadth with one facet lighter than the rest." },
      { score: 3, means: "Some exploration but missing scenarios or sensitivities." },
      { score: 2, means: "Largely single-path with little alternative analysis." },
      { score: 1, means: "One path presented, no options, scenarios, or counterarguments." },
    ],
    independentOf: [
      "vs Pillar 7 — Pillar 4 is breadth (how many options explored); Pillar 7 is plausibility (are the numbers realistic).",
      "vs Pillar 8 — Pillar 4 produces the Coverage score; Pillar 8's 'Move 8' consumes it. The flow is one-directional — Coverage feeds conviction, never the reverse.",
    ],
  },

  P5: {
    key: "P5",
    mathType: "Arithmetic mean",
    formula: "EQI = arithmetic_mean(Citation Density, Source Quality, Provenance Tagging)",
    formulaPlain: "Average three independent 1–5 measures of how well claims are evidenced.",
    measures: [
      "Citation Density — how many citations appear per 100 lines of memo. Higher = claims are backed by references more often. Threshold: ≥15/100 lines earns a 5; <3/100 earns a 1.",
      "Source Quality — the credibility tier of the sources cited. Government filings, regulatory bodies, and established research firms score highest. Blogs, unattributed sources, or known low-quality domains score lowest. A single red-flag domain caps this sub-score at 3.0.",
      "Provenance Tagging — how well the origin of each figure or claim is labelled in the memo text (e.g. 'Per market research,' 'Mgmt estimate,' 'Per the client's framing'). Two counts: Provenance Tag Count (total origin-labels present) and Provenance Type Count (distinct kinds of origin used). More and more varied tagging = more traceable evidence.",
    ],
    calcLogic:
      "Each part is scored 1–5 and averaged. " +
      "Citation Density: raw citations-per-100-lines converted to a 1–5 band. " +
      "Source Quality: driven by the credibility tier of cited sources; capped at 3.0 if any red-flag low-quality domain appears (the red-flag list is exclusive — other weak domains can be flagged as candidates but don't auto-cap). " +
      "Premium Count = the number of high-credibility sources (top-tier: regulatory bodies, established research firms, official filings); a higher count improves Source Quality. " +
      "Red Flag Count = sources from known low-quality domains (0 is ideal). " +
      "Provenance tags only count when literally present in the memo text.",
    scoreMeanings: [
      { score: 5, means: "Well-cited throughout, credible sources, every figure traceable." },
      { score: 4, means: "Good citation with minor traceability gaps." },
      { score: 3, means: "Adequate sourcing, or capped by a red-flag domain." },
      { score: 2, means: "Sparse citation or several weak sources." },
      { score: 1, means: "Largely uncited or reliant on low-quality sources." },
    ],
    independentOf: [
      "vs Pillar 7 — Pillar 5 is source credibility; Pillar 7's calibration is about whether claim confidence matches its evidence.",
      "vs Pillar 6 — Pillar 5 is about citations; Pillar 6 is about assumptions.",
    ],
  },

  P6: {
    key: "P6",
    mathType: "Arithmetic mean",
    formula: "AQI = arithmetic_mean(Identification, Attribution, Sensitivity Awareness)",
    formulaPlain:
      "Average three 1–5 measures of how openly the memo handles its assumptions.",
    measures: [
      "Identification — are assumptions named in a dedicated place?",
      "Attribution — is each assumption's source stated?",
      "Sensitivity Awareness — is each linked to a way of testing if it holds?",
    ],
    calcLogic:
      "Each part is scored 1–5 and averaged. Assumption tags count only when literal. A provenance audit table is credited only when it's a real structured table with named columns.",
    scoreMeanings: [
      { score: 5, means: "Assumptions named, sourced, and tied to validation tests." },
      { score: 4, means: "Mostly explicit with minor attribution gaps." },
      { score: 3, means: "Assumptions named but loosely sourced or untested." },
      { score: 2, means: "Few assumptions surfaced; mostly implicit." },
      { score: 1, means: "Guesses buried in the analysis, never labelled." },
    ],
    independentOf: [
      "vs Pillar 5 — Pillar 6 is assumptions; Pillar 5 is citations.",
      "vs Pillar 7 — Pillar 6 is whether an assumption is attributed; Pillar 7 is whether the language's certainty matches the evidence.",
      "vs Pillar 2 — Pillar 6 is attribution/validation; Pillar 2 is fidelity to the framing.",
    ],
  },

  P7: {
    key: "P7",
    mathType: "Arithmetic mean",
    formula: "ORI = arithmetic_mean(Numerical Plausibility, Claim Calibration, Financial Internal Consistency)",
    formulaPlain:
      "Average three 1–5 measures of whether the numbers reflect how the world actually works — but only after checking there are enough financial claims to score.",
    measures: [
      "Numerical Plausibility (NP) — do figures fall in real-world benchmark ranges?",
      "Claim Calibration (CC) — does each claim's confidence match its evidence?",
      "Financial Internal Consistency (FIC) — do the numbers hold together as a model?",
    ],
    calcLogic:
      "A sparse-data protocol runs first by counting scoreable financial claims: 5+ uses the full formula; 3–4 uses ORI=(NP+CC+FIC×0.5)/2.5; 1–2 uses the average of NP and CC only; 0 means NOT SCORED (and an absent-financials memo is routed to Pillar 4, not penalised here). Numerical Plausibility compares each figure against the Benchmark Library, which is a prior, not a ceiling — a well-justified deviation still earns full credit.",
    scoreMeanings: [
      { score: 5, means: "Figures plausible, confidence well-calibrated, model internally consistent." },
      { score: 4, means: "Mostly realistic with a minor over-confident claim." },
      { score: 3, means: "Some figures at the edge of plausible, or thin calibration." },
      { score: 2, means: "Several implausible figures or over-confident claims." },
      { score: 1, means: "Numbers don't reflect reality or contradict the model." },
    ],
    independentOf: [
      "vs Pillar 1 — Pillar 7 is about numbers that don't scale realistically; Pillar 1 is about stated numbers that directly contradict.",
      "vs Pillar 5 — Pillar 7's calibration is about confidence vs evidence strength; Pillar 5 is about source credibility.",
    ],
  },

  P8: {
    key: "P8",
    mathType: "Arithmetic mean",
    formula: "SQI = arithmetic_mean(Specificity, Decision Architecture, Integration, Move 8)",
    formulaPlain:
      "Average four 1–5 measures of how well the recommendation is built, including whether its confidence matches how much was explored.",
    measures: [
      "Specificity — is the recommendation concrete and quantified?",
      "Decision Architecture — does it have success gates and kill conditions?",
      "Integration — do the actions chain together coherently?",
      "Conviction Match (Move 8) — does the memo's confidence in its recommendation match how thoroughly it explored the problem? A highly confident recommendation on thin analysis is over-confident and is penalized; matched conviction earns full credit.",
    ],
    calcLogic:
      "Each part is scored 1–5 and averaged. " +
      "Move 8 (the conviction-vs-exploration check) reads the Coverage score (CovI) from Pillar 4: " +
      "if Coverage was above 3.5, high conviction earns a 5; " +
      "3.0–3.5 earns 3–4; " +
      "2.5–3.0 earns 2–3; " +
      "below 2.5, high conviction is penalised to 1–2 (confident recommendation on thin exploration). " +
      "In plain terms: if you explored few options and scenarios (low Coverage), you cannot justify a boldly confident recommendation — Move 8 catches that mismatch. " +
      "Decision Architecture scores whether gates exist and are sound — not how clearly they're communicated (that is D5).",
    scoreMeanings: [
      { score: 5, means: "Specific, quantified recommendation with sound gates and matched conviction." },
      { score: 4, means: "Clear recommendation with a minor gap in gates or chaining." },
      { score: 3, means: "Reasonable recommendation but vague gates or mismatched conviction." },
      { score: 2, means: "Loose recommendation, weak architecture." },
      { score: 1, means: "No clear, well-built recommendation." },
    ],
    independentOf: [
      "vs D5 — Pillar 8 is whether the decision architecture exists and is sound; D5 is whether it's clearly communicated.",
      "vs Pillar 2 — Pillar 8 is recommendation construction; Pillar 2 is fidelity to the framing.",
      "vs Pillar 7 — Pillar 8 is memo-level conviction; Pillar 7's calibration is claim-level.",
    ],
  },

  D1: {
    key: "D1",
    mathType: "Arithmetic mean",
    formula: "II = mean(Verdict-First, Acronym Discipline, Numerical Density, Sentence Complexity, Exec Summary Length)",
    formulaPlain:
      "Average five 1–5 measurements of how much effort the memo takes to read.",
    measures: [
      "Verdict-First — does the conclusion come first?",
      "Acronym Discipline — are acronyms defined?",
      "Numerical Density — not so number-packed it's unreadable",
      "Sentence Complexity — reasonable sentence length",
      "Exec Summary Length — appropriately sized, not a wall of text",
    ],
    calcLogic:
      "Each sub-dimension is a raw count or measurement (taken from the Executive Summary where specified), converted to a 1–5 and averaged.",
    scoreMeanings: [
      { score: 5, means: "Verdict up front, clean prose, right-sized summary." },
      { score: 4, means: "Easy to read with one minor friction." },
      { score: 3, means: "Readable but needs effort in places." },
      { score: 2, means: "Dense or buries the verdict." },
      { score: 1, means: "Hard to read; conclusion is lost." },
    ],
    independentOf: [
      "vs D2 — D1 is reading effort (prose); D2 is visual layout (formatting).",
    ],
  },

  D2: {
    key: "D2",
    mathType: "Arithmetic mean",
    formula: "SCI = mean(Header Hierarchy, Visual Scaffolding, Chapter Prefix, Bold Discipline, Cross-References)",
    formulaPlain:
      "Average five 1–5 measurements of how easy the document is to scan.",
    measures: [
      "Header Hierarchy — clear heading levels",
      "Visual Scaffolding — tables/structure where they help",
      "Chapter Prefix — consistent chapter labelling",
      "Bold Discipline — bold used sparingly (measured per 1000 lines)",
      "Cross-References — links between sections that work",
    ],
    calcLogic:
      "Each sub-dimension is a count, converted to a 1–5 and averaged. Bold is normalised per 1000 lines so longer memos aren't unfairly penalised.",
    scoreMeanings: [
      { score: 5, means: "Clean hierarchy, helpful tables, disciplined emphasis, working links." },
      { score: 4, means: "Well-formatted with one minor inconsistency." },
      { score: 3, means: "Navigable but uneven formatting." },
      { score: 2, means: "Cluttered or inconsistent layout." },
      { score: 1, means: "Hard to scan; formatting works against the reader." },
    ],
    independentOf: [
      "vs Pillar 3 — D2 is whether a chapter is formatted clearly; Pillar 3 is whether it exists at all.",
    ],
  },

  D3: {
    key: "D3",
    mathType: "Arithmetic mean",
    formula: "ACI = mean(Voice, Stakeholder Framing, Executive Terminology, Hedging Discipline, Salience Hierarchy)",
    formulaPlain:
      "Average five 1–5 measurements of whether the writing fits an executive decision-maker.",
    measures: [
      "Voice — executive rather than operator tone",
      "Stakeholder Framing — written for the decision-maker",
      "Executive Terminology — right vocabulary (matched against a defined list)",
      "Hedging Discipline — confident, not drowning in qualifiers (hedge-to-strong ratio)",
      "Salience Hierarchy — the most important points are surfaced, not buried",
    ],
    calcLogic:
      "Each sub-dimension is measured against a defined rule (terms matched to a list; hedge and strong markers counted) and averaged.",
    scoreMeanings: [
      { score: 5, means: "Confident executive voice, right terms, key points up front." },
      { score: 4, means: "Executive tone with minor hedging or buried points." },
      { score: 3, means: "Mixed voice or noticeable hedging." },
      { score: 2, means: "Operator tone or heavy qualification." },
      { score: 1, means: "Wrong audience; key points lost in detail." },
    ],
    independentOf: [],
  },

  D4: {
    key: "D4",
    mathType: "Arithmetic mean",
    formula: "CCI = mean(Timed Actions, Basis Tags, Risk Annotations, Quantification, Self-Containment)",
    formulaPlain:
      "Average five 1–5 measurements of whether the reader is given everything they need.",
    measures: [
      "Timed Actions — actions have owners and timing",
      "Basis Tags — claims show what they're based on",
      "Risk Annotations — risks laid out clearly",
      "Quantification — claims are quantified where they should be (a mechanical ratio)",
      "Self-Containment — the Executive Summary stands alone",
    ],
    calcLogic:
      "Each sub-dimension is a count, converted to a 1–5 and averaged. Self-Containment counts how many cross-reference dependencies the Executive Summary has — it must NOT score whole-memo consistency (that's Pillar 1).",
    scoreMeanings: [
      { score: 5, means: "Actions owned and timed, claims sourced, risks clear, summary self-standing." },
      { score: 4, means: "Mostly complete with one missing element." },
      { score: 3, means: "Some gaps in timing, basis, or self-containment." },
      { score: 2, means: "Several missing pieces; summary leans on the body." },
      { score: 1, means: "Reader lacks what they need to act." },
    ],
    independentOf: [
      "vs Pillar 1 — 'the document disagrees with itself' is Pillar 1; 'the Exec Summary can't be read on its own' is D4.",
    ],
  },

  D5: {
    key: "D5",
    mathType: "Arithmetic mean",
    formula: "ACTI = mean(Verdict Clarity, First Action, Capital Ask, Priority Sequencing, Threshold Legibility)",
    formulaPlain:
      "Average five 1–5 measurements of how clear the immediate next step is.",
    measures: [
      "Verdict Clarity — an unambiguous go / no-go",
      "First Action — a specific first thing to do",
      "Capital Ask — the money being requested is stated",
      "Priority Sequencing — what order things happen in",
      "Threshold Legibility — kill/default conditions are easy to find and read",
    ],
    calcLogic:
      "Each sub-dimension is scored 1–5 and averaged. This pillar scores legibility only — whether the decision thresholds are clearly communicated — never whether they exist or are sound (that's Pillar 8). Capital ask is read from explicit text, not inferred.",
    scoreMeanings: [
      { score: 5, means: "Clear verdict, specific first action, capital stated, default action legible." },
      { score: 4, means: "Clear next step with one detail buried." },
      { score: 3, means: "Direction given but some specifics unclear." },
      { score: 2, means: "Vague on what to actually do next." },
      { score: 1, means: "Reader can't tell what to do." },
    ],
    independentOf: [
      "vs Pillar 8 — 'a kill condition is missing or illogical' is Pillar 8; 'it exists but is buried or unclear' is D5.",
    ],
  },
};
