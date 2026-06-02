# Innovera Eval V3 — Documentation Index

**Read these files in this order before writing any code.** All are plain markdown — no extraction needed. Ignore any `.docx` files in this folder; the markdown versions are the source of truth and contain identical content.

## Read order

1. **`Innovera_Eval_V3_Framework_Spec_v1.0.md`** — the scoring framework. 13 dimensions, formulas, the two-stage architecture, traceability principle, Pillar 7 benchmark library (Section 8 — seed this into the DB), versioning rules (Section 9), and v1.0/v1.5 scope guards (Section 10).

2. **`Innovera_Eval_V3_Dimension_Hardening.md`** — per-dimension detail: full sub-dimension threshold tables, the exact traceability-log (TR) format each dimension must emit, and dimension-specific AI guardrails (AG). Use this when implementing the scoring logic for any dimension.

3. **`Innovera_Eval_V3_UIUX_Design_Spec.md`** — the screen-by-screen UI: visual design language, the six pages + scorecard, every button, edit/delete placement, and the v1.0-vs-v1.5 feature table.

4. **`Innovera_Eval_V3_ClaudeCode_Phase0-1.md`** — the build instructions. Contains the Bootstrap Prompt, the CLAUDE.md content to create, Phase 0 (foundation/shell), and Phase 1 (data layer), each with a verification checklist. Build only what the current phase specifies.

## The non-negotiables (also enforced in CLAUDE.md)

- Stage 1 and Stage 2 scores are NEVER combined into one number.
- Decision Confidence = Memo Confidence in v1.0 (Risk Multiplier held at 1.0; suppressor is v1.5). Quiet placeholder, not a hero number.
- Pillar 7 IS active in v1.0 (benchmark-library-backed).
- Do NOT build: Risk Analysis tab, Effective Penalty panel, active Risk Multiplier.
- Traceability is one-directional: agent measures/classifies → server computes. Never reverse-engineer to a target score.
- Framing document is sent first in every LLM call.
- Every delete is two-step with confirmation.
- Design: white/black/grey + single orange accent; shared sidebar + top bar shell.

## Build discipline

Execute one phase, run its verification checklist, report results, and wait for confirmation before the next phase. Do not scaffold future phases early.
