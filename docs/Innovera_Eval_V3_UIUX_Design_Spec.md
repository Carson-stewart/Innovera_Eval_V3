# Innovera Eval V3 — UI/UX Design Specification

**Version:** 1.0
**Date:** May 2026
**Purpose:** Complete screen-by-screen design map for the V3 Memo Evaluator + Decision Framing Sanity Checker. Incorporates coworker feedback from the prior scoring system. This document feeds the Claude Code build.
**Scope:** v1.0 build. Items marked "(v1.5)" are placeholders held for the next version.

---

## Design Principles (from coworker feedback)

What the team explicitly valued in the prior system — preserved and strengthened:

1. **Clear delineation between Frame checking and Memo checking** — two distinct modules, never blurred.
2. **Memo scoring is one-click to initiate** — the "Score a Memo" action is always prominent.
3. **Transparent methodology** — the Scoring Guide stays a first-class page.
4. **Left sidebar navigation + History** — kept exactly; the team relies on it.
5. **Triage Matrix (pass/fail for framing)** — kept; it's how the team narrows framing issues fast.
6. **Dashboard as the central overview** — kept.
7. **Self-auditing ("catches its own errors")** — kept and surfaced as a collapsible diagnostics strip.

What we are fixing:

| Feedback | Fix in v1.0 |
|---|---|
| "Decision Confidence — don't know what to do with it" | Demoted to a quiet placeholder under one hero Memo Confidence score, labeled "Suppressor pending v1.5." Becomes a full second score only when the v1.5 risk suppressor launches. |
| "Effective Penalty calculator seemed circular (69 − 10 = 59)" | The Risk Erosion Summary / Effective Penalty panel is REMOVED in v1.0 — it displayed math from the not-yet-active suppressor. |
| "Want a 'ready to ship' marker on the first screen" | New status badge — Ready to Ship / Needs Work / Major Rework — on Scorecard, Dashboard, and History. |
| "Gaps and Edits tabs are the most useful" | Gaps and Edits are the lead, emphasized tabs on the Scorecard. |
| "Revised Framing said 'no revisions required' despite flagged issues" | Revised Framing now always generates concrete rewrites for every flagged issue, minor or major. |
| "Make it closer to Innovera's design themes" | Innovera design language is a hard build requirement (white/black/grey + orange "A" accent). |

---

# PART 1 — Overall Visual Design

**The feel:** Clean, calm, professional — a high-end financial tool. Lots of white space. The memo content and scores are the focus; the interface stays quiet.

**Colors:**
- White background everywhere (main canvas)
- Black / dark grey for text
- Light grey for borders, dividers, card edges
- Orange (Innovera "A" accent) — used sparingly: active menu item, primary buttons, key highlights
- Status palette (scores/alerts only): green = good / Ready to Ship, amber = caution / Needs Work, red = low / Major Rework

**Shape & spacing:** Soft cards (rounded corners, thin grey borders) on white. Generous spacing. Clear visual grouping.

**Text:** One clean modern font. Big bold numbers for the hero score. Normal weight for body. Small grey text for labels and timestamps.

**Shared shell (every page):**
- **Left sidebar** — main menu, icon + label per page; active page highlighted in orange.
- **Top bar** — page title left; utility items right (user initials; search where relevant; page-level actions like edit/overflow).
- **Main area** — the white working space; the only part that changes per page.

---

# PART 2 — Pages, Buttons & Features

Six sidebar pages, plus the Scorecard (reachable only via History and immediately after scoring — not in the sidebar).

---

## Page 1 — Dashboard
*"What's the state of everything?"*

**Contents:**
- Row of **4 summary cards**: total memos scored, average Memo Confidence, count Ready to Ship, count flagged for attention.
- **Recent Activity list** — last several memos: name, typology tag, Memo Confidence, **status badge**, date.
- **Alerts panel** — memos flagged Major Rework or needing review.
- **ELO leaderboard preview** — top few memos by ELO.

**Buttons / features:**
- "Score a Memo" — primary orange button → Score Memo (Page 4).
- "Run Sanity Check" — secondary button → Upload Framing (Page 2).
- Each Recent Activity row is clickable → that memo's Scorecard.
- "View all" on each panel → History.

---

## Page 2 — Upload Framing
*Start a framing quality check.*

**Contents:**
- **Upload zone** — drag-and-drop a framing file, OR paste text, OR fill wizard fields (Decision Question / Context / Key Questions).
- Short explainer of what the Sanity Check does.
- **Typology selector** (1A / 1B / 2A / 2B) if known.

**Buttons / features:**
- "Upload file" + drag-drop area.
- "Paste text instead" toggle.
- **Edit** — framing text is editable inline before running.
- "Run Sanity Check" — primary orange button → runs (Claude + Gemini behind the scenes, progress indicator) → Sanity Check Results (Page 3).

---

## Page 3 — Sanity Check Results
*Is the framing solid before a memo is built on it?*

**Contents:**
- **Verdict banner** (full width) — "Ready for Analysis" (green) / "Major Rework Needed" (red).
- **Pass / Fail / Enhance** count chips.
- **Triage Matrix** — grid of each check × each model's pass/fail; disagreements flagged (the "Escalated" concept).
- **Consolidated Report** — critical issues, each as Issue / Impact / Fix, severity-tagged (High/Medium/Low).
- **Revised Framing panel** — concrete rewrites for EVERY flagged issue (minor and major).

**Buttons / features:**
- Each issue expandable for detail.
- **Edit** — the suggested rewrite is editable before copy/export.
- "Copy revised framing" button.
- "Export report" button.
- **Delete** — remove this saved framing/sanity record (overflow menu; two-step confirm).
- "Score a memo against this framing" → carries framing into Score Memo (Page 4).

---

## Page 4 — Score Memo
*The main event. Three-step flow + Risk Gate.*

**Step tracker across top: 1 — 2 — 3**

- **Step 1 — Framing:** upload or select the framing document. (Edit available.)
- **Step 2 — Typology:** pick 1A / 1B / 2A / 2B (large clear choice buttons).
- **Step 3 — Memo:** upload or paste the memo to score. (Edit memo name/notes available.)

**Then the Risk Review Gate:**
- AI shows **top 5 risks**, one card each.
- Each card: risk statement, classification (Bull / Bear / Bilateral), source (Typology / Framing / Empirical / LLM inference), severity, and a "why this might NOT be a risk" line.
- Each card: **Approve / Reject** buttons + **Edit** (pencil) to adjust wording/classification before approving.
- "Need deeper review" button → Tier 2 deep pass.

**Buttons / features:**
- "Back" / "Next" between steps.
- "Start Scoring" — primary orange button; only active once all 5 risks are reviewed.
- **Progress view** while scoring runs (per-chapter passes completing).
- On completion → Memo Scorecard.

---

## Page 4b — Memo Scorecard
*The result. Reachable via History or right after scoring.*

**Top bar additions:** memo title with **Edit** (pencil) for name/typology/notes; **overflow "⋯" menu** with Export and **Delete** (two-step confirm).

**Contents (top to bottom):**
1. **Engine diagnostics strip** — collapsible, collapsed by default. Reads e.g. "Engine diagnostics: 1 error, 11 calibration warnings — click to expand." Expanded: the self-audit detail (agent self-reported vs server-computed scores, calibration drift entries, any math-verification failure). This is the traceability layer from the framework.
2. **Hero score block:**
   - **MEMO CONFIDENCE** — one big number.
   - **Status badge** beside it — Ready to Ship (green) / Needs Work (amber) / Major Rework (red).
   - **Quiet line beneath:** "Decision Confidence: same as Memo Confidence (Suppressor pending v1.5)." *(In v1.5 this becomes a full second score.)*
3. **Stage 1 / Stage 2 matrix** — the 2×2 showing which quadrant the memo sits in.
4. **ELO rating** + comparison count + **rubric version stamp**.
5. **Per-pillar strip** — all 13 dimensions as color-coded chips (green/amber/red) for at-a-glance erosion.
6. **Tabs** (Gaps and Edits emphasized as the lead tabs):
   - **Gaps (n)** — what's missing; each item Issue / Impact / Fix + severity tag.
   - **Edits (n)** — suggested improvements; same structure.
   - **Score Breakdown** — per-pillar scores + the per-pillar **traceability log** (TR-log content).
   - **Score Explanation** — plain-language why behind the scores.
   - **Recovery** — what would lift the score and by how much.
   - *(Risk Analysis tab — HIDDEN in v1.0; returns in v1.5 with the suppressor.)*

**Buttons / features:**
- Edit (title/metadata), Export, Delete (overflow).
- "Compare to another version" → version comparison.
- "Add to ELO comparison."

---

## Page 5 — History
*Every past run and how quality trends.*

**Contents:**
- **Searchable, filterable table** — columns: memo name, typology, Memo Confidence, **status badge**, ELO, rubric version, date.
- Filters: typology, date range, rubric version.
- **ELO progression chart** — line showing trend over time.
- **Version comparison tool** — pick two runs / two versions → side-by-side.

**Buttons / features:**
- Search box + filter dropdowns.
- Each row clickable → that Scorecard.
- **Delete** — trash icon at the far right of each row (two-step confirm).
- "Compare selected" (after ticking two rows).
- "Export table."

---

## Page 6 — Scoring Guide
*Plain-language methodology explainer.*

**Contents (read-only):**
- What Confidence Erosion means.
- The two scores (and why Decision Confidence is a placeholder until v1.5).
- The 13 dimensions — one line each.
- What a 5/5 means (zero-defect criterion).
- How risks are reviewed (Risk Gate, Framework's-Eye-View Caveat).
- How memos get compared (ELO, in plain terms).
- Why rubrics are versioned.
- What the tool does NOT do.

**Buttons / features:**
- Left **mini-menu** to jump to each section.
- No actions — purely explanatory.

---

# PART 3 — Simple Layout Diagrams

Fixed shell = sidebar (left) + top bar (top). Only the main area changes.

### Dashboard
```
[ Sidebar ] [ Top bar: "Dashboard" .................... user ]
            [ 4 summary cards in a row                       ]
            [ Recent Activity (wide, left) ][ Alerts (right) ]
            [ ELO leaderboard preview (full width, bottom)   ]
```

### Upload Framing
```
[ Sidebar ] [ Top bar: "Upload Framing" ]
            [ Big centered upload zone (drag-drop / paste)   ]
            [ Typology selector                              ]
            [ "Run Sanity Check" (centered, orange)          ]
```

### Sanity Check Results
```
[ Sidebar ] [ Top bar: "Sanity Check" ........ [⋯ Delete]   ]
            [ Verdict banner (full width)                    ]
            [ Pass / Fail / Enhance chips                    ]
            [ Triage Matrix grid (full width)                ]
            [ Consolidated Report (issues stacked)           ]
            [ Revised Framing (editable) [Copy] [Export]     ]
```

### Score Memo (3-step + Risk Gate)
```
[ Sidebar ] [ Top bar: "Score Memo" ]
            [ Step tracker:  1 — 2 — 3                       ]
            [ Current step card (centered) [Back] [Next]     ]

  Risk Gate:
            [ Risk card 1: stmt / class / source / severity  ]
            [           [Edit] [Approve] [Reject]            ]
            [ ... cards 2–5 ...                               ]
            [ "Need deeper review"     "Start Scoring"(orange)]
```

### Memo Scorecard
```
[ Sidebar ] [ Top bar: "Scorecard"  [✎ title] [⋯ Export/Delete] ]
            [ ▸ Engine diagnostics: 1 error, 11 warnings (collapsed) ]
            [ MEMO CONFIDENCE  69     [ Ready to Ship ✓ ]    ]
            [ Decision Confidence: same as Memo (pending v1.5)]
            [ Stage1/Stage2 matrix ][ ELO + version stamp    ]
            [ Per-pillar strip: 13 color chips               ]
            [ TABS: Gaps(6) | Edits(6) | Breakdown | Explanation | Recovery ]
            [ ─────────────────────────────────────────────  ]
            [ tab content: Issue / Impact / Fix + severity    ]
```

### History
```
[ Sidebar ] [ Top bar: "History" ............ search box ]
            [ Filter dropdowns row                           ]
            [ ELO progression line chart                      ]
            [ Table: name | typology | conf | badge | ELO |   ]
            [        version | date | [🗑 delete]              ]
            [ [Compare selected] [Export table]               ]
```

### Scoring Guide
```
[ Sidebar ] [ Top bar: "Scoring Guide" ]
            [ mini-menu ][ readable explainer, section by section ]
```

---

# PART 4 — Edit & Delete Placement (Summary)

| Action | Where it lives | Behavior |
|---|---|---|
| **Edit** framing text | Upload Framing | Inline editable before running |
| **Edit** revised framing | Sanity Check Results | Inline editable before copy/export |
| **Edit** risk wording/classification | Risk Gate cards | Pencil per card, before approving |
| **Edit** memo name / typology / notes | Scorecard top bar | Pencil next to title |
| **Delete** scoring run | History row | Trash icon, far right; two-step confirm |
| **Delete** scorecard | Scorecard overflow "⋯" | Two-step confirm |
| **Delete** framing/sanity record | Sanity Check Results overflow | Two-step confirm |

**Rule:** every Delete is two-step (click → confirmation dialog "…cannot be undone" → confirm). No one-click destructive actions anywhere.

---

# PART 5 — v1.0 vs v1.5 (what's held back)

| Element | v1.0 | v1.5 |
|---|---|---|
| Memo Confidence | Hero score | Hero score |
| Decision Confidence | Quiet placeholder ("pending v1.5") | Full second score with explanation |
| Risk Multiplier / Suppressor | Held at 1.0 (inactive) | Active, multiplicative |
| Risk Analysis tab | Hidden | Visible |
| Effective Penalty panel | Removed | Returns, with corrected (non-circular) presentation |
| Pillar 7 (Output Realism) | Active, benchmark-backed | Active |
| Status badge | Active | Active |
| Engine diagnostics strip | Active | Active |

---

*End of UI/UX Design Specification v1.0*
