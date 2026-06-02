// Single source of truth for all 13 pillar/dimension names, stage labels,
// one-line glosses (tooltip), and fuller detail text (expandable panel).
//
// Import from here — never hardcode pillar names or descriptions in components.

export type PillarExplanation = {
  key: string;
  name: string;
  stage: "Stage 1" | "Stage 2";
  gloss: string;   // one line — shown in tooltip
  detail: string;  // 2-3 sentences — shown in expandable panel
};

export const PILLAR_EXPLANATIONS: Record<string, PillarExplanation> = {
  P1: {
    key: "P1",
    name: "Coherence",
    stage: "Stage 1",
    gloss: "Does the memo agree with itself?",
    detail:
      "Checks that the memo doesn't contradict itself — the same number means the same thing throughout, claims in one section don't clash with another, and any tensions are acknowledged rather than ignored.",
  },
  P2: {
    key: "P2",
    name: "Problem Formulation",
    stage: "Stage 1",
    gloss: "Does it answer the actual question that was asked?",
    detail:
      "Checks that the memo addresses the specific decision in the framing document — not a nearby topic — and that it answers the key questions the framing raised, with concrete next steps.",
  },
  P3: {
    key: "P3",
    name: "Structural Accuracy",
    stage: "Stage 1",
    gloss: "Are the expected chapters all there?",
    detail:
      "Checks that the memo includes the chapters expected for its type of decision. A memo can have every chapter present yet still answer the wrong question — that's why this is separate from Problem Formulation.",
  },
  P4: {
    key: "P4",
    name: "Coverage",
    stage: "Stage 1",
    gloss: "Did it explore enough options and scenarios?",
    detail:
      "Checks the breadth of analysis — were multiple options compared, were best/worst/likely scenarios considered, and were the obvious counterarguments examined, rather than just presenting one path.",
  },
  P5: {
    key: "P5",
    name: "Evidence Quality",
    stage: "Stage 1",
    gloss: "Are the claims backed by good sources?",
    detail:
      "Checks how well claims are supported — how often they're cited, whether the sources are credible (government, research firms, filings) rather than low-quality, and whether the origin of each figure is traceable.",
  },
  P6: {
    key: "P6",
    name: "Assumption Quality",
    stage: "Stage 1",
    gloss: "Are the assumptions stated and labelled?",
    detail:
      "Checks whether the memo names its assumptions out loud, says where each one came from, and links them to a way of testing whether they hold — instead of burying guesses inside the analysis.",
  },
  P7: {
    key: "P7",
    name: "Output Realism",
    stage: "Stage 1",
    gloss: "Do the numbers reflect how the world actually works?",
    detail:
      "Checks the financial figures against real-world benchmark ranges — are the growth rates, margins, and returns plausible, does the confidence of each claim match its evidence, and do the numbers hold together as a coherent model.",
  },
  P8: {
    key: "P8",
    name: "Solution Quality",
    stage: "Stage 1",
    gloss: "Is the recommendation clear and well-built?",
    detail:
      "Checks the recommendation itself — is it specific and quantified, does it come with success gates and kill conditions, and does its confidence match how thoroughly the analysis explored the question.",
  },
  D1: {
    key: "D1",
    name: "Interpretability",
    stage: "Stage 2",
    gloss: "Is it easy to read and understand?",
    detail:
      "Checks the reading effort — does the verdict come first, are acronyms defined, are sentences a reasonable length, and is the summary an appropriate size rather than a wall of text.",
  },
  D2: {
    key: "D2",
    name: "Structural Clarity",
    stage: "Stage 2",
    gloss: "Is it well-formatted and easy to scan?",
    detail:
      "Checks the visual layout — clear headings, tables where they help, sensible use of bold, and working cross-references — so a reader can navigate the document quickly.",
  },
  D3: {
    key: "D3",
    name: "Audience Calibration",
    stage: "Stage 2",
    gloss: "Is it written for an executive reader?",
    detail:
      "Checks whether the tone and language fit a decision-maker audience — an executive voice rather than an operator's, the right terminology, and confident framing rather than excessive hedging.",
  },
  D4: {
    key: "D4",
    name: "Communicative Completeness",
    stage: "Stage 2",
    gloss: "Does it give the reader everything they need?",
    detail:
      "Checks that actions have owners and timing, that claims show their basis, that risks are laid out clearly, and that the summary can be understood on its own without digging into the body.",
  },
  D5: {
    key: "D5",
    name: "Actionability",
    stage: "Stage 2",
    gloss: "Is the immediate next step crystal clear?",
    detail:
      "Checks whether a reader knows exactly what to do next — a clear go/no-go, a specific first action, the capital being asked for, and what happens if no decision is made.",
  },
};

// Ordered arrays for rendering grouped lists
export const STAGE_1_KEYS = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"] as const;
export const STAGE_2_KEYS = ["D1", "D2", "D3", "D4", "D5"] as const;
