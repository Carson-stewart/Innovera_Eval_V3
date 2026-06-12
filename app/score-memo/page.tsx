"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TopBar } from "@/components/shell/TopBar";

// ─── Types ────────────────────────────────────────────────────────────────────

type FlowStep = "step1" | "step2" | "step3" | "risk-gate" | "progress" | "done";

type Typology = "ONE_A" | "ONE_B" | "TWO_A" | "TWO_B";

interface Chapter {
  title: string;
  text: string;
  scored: boolean;
  index: number;
}

type RiskDecision = "undecided" | "approved" | "rejected";

interface RiskItem {
  statement: string;
  classification: "BULL" | "BEAR" | "BILATERAL";
  source: "TYPOLOGY" | "FRAMING" | "EMPIRICAL" | "LLM_INFERENCE";
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  whyNotARisk: string;
}

interface RiskCardState extends RiskItem {
  decision: RiskDecision;
  editing: boolean;
  editStatement: string;
  editClassification: "BULL" | "BEAR" | "BILATERAL";
  editSeverity: "CRITICAL" | "HIGH" | "MEDIUM";
  loadingDeep: boolean;
}

interface StepStatus {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
}

// ─── Step Tracker ─────────────────────────────────────────────────────────────

function StepTracker({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "Framing" },
    { n: 2, label: "Typology" },
    { n: 3, label: "Memo" },
  ];
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((s, i) => {
        const done = s.n < current;
        const active = s.n === current;
        return (
          <div key={s.n} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                active
                  ? "bg-brand-orange border-brand-orange text-white"
                  : done
                  ? "bg-orange-100 border-brand-orange-border text-brand-orange-hover"
                  : "bg-white border-gray-300 text-gray-400"
              }`}
            >
              {done ? "✓" : s.n}
            </div>
            <span
              className={`text-sm font-medium ${
                active ? "text-brand-orange" : done ? "text-brand-orange" : "text-gray-400"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && <div className="w-8 h-px bg-gray-300 mx-1" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────

function UploadZone({
  accept,
  onFile,
  label,
}: {
  accept: string;
  onFile: (f: File) => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
        dragging ? "border-brand-orange-border bg-brand-orange-light" : "border-gray-300 hover:border-brand-orange-ring bg-white"
      }`}
    >
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-xs text-gray-400 mt-1">{accept}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

// useSearchParams requires a Suspense boundary at the page level (Next 14 CSR bailout).
export default function ScoreMemoPage() {
  return (
    <Suspense>
      <ScoreMemoFlow />
    </Suspense>
  );
}

function ScoreMemoFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Flow state
  const [flowStep, setFlowStep] = useState<FlowStep>("step1");

  // ── Step 1 — Framing
  const [framingId, setFramingId] = useState<number | null>(null);
  const [framingContent, setFramingContent] = useState("");
  const [framingPasteMode, setFramingPasteMode] = useState(false);
  const [framingPasteText, setFramingPasteText] = useState("");
  const [framingEditing, setFramingEditing] = useState(false);
  const [framingEditText, setFramingEditText] = useState("");
  const [framingLoading, setFramingLoading] = useState(false);
  const [framingError, setFramingError] = useState("");

  // ── Step 2 — Typology
  const [typology, setTypology] = useState<Typology | null>(null);

  // ── Step 3 — Memo
  const [memoId, setMemoId] = useState<number | null>(null);
  const [memoName, setMemoName] = useState("");
  const [memoChapters, setMemoChapters] = useState<Chapter[]>([]);
  const [memoPasteMode, setMemoPasteMode] = useState(false);
  const [memoPasteText, setMemoPasteText] = useState("");
  const [memoPasteName, setMemoPasteName] = useState("");
  const [memoLoading, setMemoLoading] = useState(false);
  const [memoError, setMemoError] = useState("");
  const [memoNameEditing, setMemoNameEditing] = useState(false);

  // ── Risk Gate
  const [riskCards, setRiskCards] = useState<RiskCardState[]>([]);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState("");
  const [riskCaveat, setRiskCaveat] = useState("");

  // ── Framing gate (checker v1.2, T3 — advisory: visible, never blocking)
  const [framingGate, setFramingGate] = useState<{
    status: "not-run" | "run";
    gateVerdict?: string | null;
    criticalCount?: number;
    sanityCheckId?: number;
    createdAt?: string; // latest check's date — shown so multi-run framings are unambiguous
  } | null>(null);

  // ── Handoff (T1): framing preselected via /score-memo?framingId=N from a
  // Sanity Check report. null = normal flow (today's behavior, unchanged).
  const [handoff, setHandoff] = useState<{
    name: string;
    revisionNumber: number | null;
    parentName: string | null;
  } | null>(null);

  // ── Progress
  const [eventId, setEventId] = useState<string | null>(null);
  const [progressSteps, setProgressSteps] = useState<StepStatus[]>([]);
  const [progressStatus, setProgressStatus] = useState<"running" | "completed" | "failed">("running");
  const [progressError, setProgressError] = useState("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Step 1 helpers ────────────────────────────────────────────────────────

  async function fetchFramingGate(id: number | null) {
    if (id === null) {
      setFramingGate(null);
      return;
    }
    try {
      const res = await fetch(`/api/framing-gate?framingId=${id}`);
      const data = (await res.json()) as {
        status: "not-run" | "run";
        gateVerdict?: string | null;
        criticalCount?: number;
        sanityCheckId?: number;
      };
      setFramingGate(res.ok ? data : null);
    } catch {
      setFramingGate(null); // chip absent on lookup failure — never blocks (advisory)
    }
  }

  // ── T1 handoff: preselect the framing named in ?framingId= ────────────────
  useEffect(() => {
    const param = searchParams.get("framingId");
    if (!param) return; // direct navigation — today's behavior, unchanged
    const id = parseInt(param, 10);
    if (isNaN(id)) return;
    let cancelled = false;
    (async () => {
      setFramingLoading(true);
      try {
        const res = await fetch(`/api/framing/${id}`);
        if (res.status === 404) {
          // deleted between check and scoring — graceful fallback to upload
          if (!cancelled) {
            setFramingError(
              "The framing from your sanity check is no longer available. Upload or paste a framing to continue."
            );
          }
          return;
        }
        const data = (await res.json()) as {
          framingId?: number; name?: string; content?: string;
          revisionNumber?: number | null; parentName?: string | null; error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Failed to load framing");
        if (cancelled) return;
        setFramingId(data.framingId ?? null);
        setFramingContent(data.content ?? "");
        setFramingEditText(data.content ?? "");
        setHandoff({
          name: data.name ?? `Framing #${id}`,
          revisionNumber: data.revisionNumber ?? null,
          parentName: data.parentName ?? null,
        });
        void fetchFramingGate(data.framingId ?? null);
      } catch (e) {
        if (!cancelled) {
          setFramingError(e instanceof Error ? e.message : "Failed to load framing");
        }
      } finally {
        if (!cancelled) setFramingLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /** Override the handoff: clear the preselected framing so a different one
   *  can be uploaded. The gate chip resets with it ("not run" until the new
   *  framing's gate is looked up). */
  function clearPreselectedFraming() {
    setHandoff(null);
    setFramingId(null);
    setFramingContent("");
    setFramingEditText("");
    setFramingGate(null);
    setFramingError("");
    setFramingPasteMode(false);
  }

  async function handleFramingFile(file: File) {
    setFramingLoading(true);
    setFramingError("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/framing/upload", { method: "POST", body: fd });
      const data = (await res.json()) as { framingId?: number; content?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setFramingId(data.framingId ?? null);
      setFramingContent(data.content ?? "");
      setFramingEditText(data.content ?? "");
      void fetchFramingGate(data.framingId ?? null);
    } catch (e) {
      setFramingError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setFramingLoading(false);
    }
  }

  async function handleFramingPasteSubmit() {
    if (!framingPasteText.trim()) return;
    setFramingLoading(true);
    setFramingError("");
    try {
      const res = await fetch("/api/framing/paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: framingPasteText, typology: typology ?? undefined }),
      });
      const data = (await res.json()) as { framingId?: number; content?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Paste failed");
      setFramingId(data.framingId ?? null);
      setFramingContent(data.content ?? "");
      setFramingEditText(data.content ?? "");
      void fetchFramingGate(data.framingId ?? null);
    } catch (e) {
      setFramingError(e instanceof Error ? e.message : "Paste failed");
    } finally {
      setFramingLoading(false);
    }
  }

  async function handleFramingEditBlur() {
    if (!framingId || framingEditText === framingContent) {
      setFramingEditing(false);
      return;
    }
    try {
      await fetch(`/api/framing/${framingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: framingEditText }),
      });
      setFramingContent(framingEditText);
    } catch {
      // best-effort
    }
    setFramingEditing(false);
  }

  // ─── Step 3 helpers ────────────────────────────────────────────────────────

  async function handleMemoFile(file: File) {
    if (!typology) return;
    setMemoLoading(true);
    setMemoError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("typology", typology);
    try {
      const res = await fetch("/api/memo/upload", { method: "POST", body: fd });
      const data = (await res.json()) as {
        memoId?: number; name?: string; chapters?: Chapter[]; error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setMemoId(data.memoId ?? null);
      setMemoName(data.name ?? "");
      setMemoChapters(data.chapters ?? []);
    } catch (e) {
      setMemoError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setMemoLoading(false);
    }
  }

  async function handleMemoPasteSubmit() {
    if (!memoPasteText.trim() || !memoPasteName.trim() || !typology) return;
    setMemoLoading(true);
    setMemoError("");
    try {
      const res = await fetch("/api/memo/paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: memoPasteText, name: memoPasteName, typology }),
      });
      const data = (await res.json()) as {
        memoId?: number; name?: string; chapters?: Chapter[]; error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Paste failed");
      setMemoId(data.memoId ?? null);
      setMemoName(data.name ?? "");
      setMemoChapters(data.chapters ?? []);
    } catch (e) {
      setMemoError(e instanceof Error ? e.message : "Paste failed");
    } finally {
      setMemoLoading(false);
    }
  }

  // ─── Risk Gate ─────────────────────────────────────────────────────────────

  async function generateRisks() {
    if (!framingId || !memoId || !typology) return;
    setRiskLoading(true);
    setRiskError("");
    setFlowStep("risk-gate");
    try {
      const res = await fetch("/api/risks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ framingId, memoId, typology }),
      });
      const data = (await res.json()) as {
        risks?: RiskItem[]; frameworkCaveat?: string; error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Risk generation failed");
      setRiskCaveat(data.frameworkCaveat ?? "");
      setRiskCards(
        (data.risks ?? []).map((r) => ({
          ...r,
          decision: "undecided",
          editing: false,
          editStatement: r.statement,
          editClassification: r.classification,
          editSeverity: r.severity,
          loadingDeep: false,
        }))
      );
    } catch (e) {
      setRiskError(e instanceof Error ? e.message : "Risk generation failed");
    } finally {
      setRiskLoading(false);
    }
  }

  function updateRiskCard(i: number, patch: Partial<RiskCardState>) {
    setRiskCards((cards) => cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  async function deepReview(i: number) {
    // "Need deeper review" re-runs risk generation for the whole memo and replaces
    // this card with a fresh risk flagged at position i from the new batch.
    // Note: this calls the same generate endpoint — it is NOT a targeted single-risk
    // deep analysis. It produces a fresh 5-risk set and surfaces the i-th risk from
    // that batch. A targeted per-risk deep-analysis mode is planned for a future phase.
    if (!framingId || !memoId || !typology) return;
    updateRiskCard(i, { loadingDeep: true });
    try {
      const res = await fetch("/api/risks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ framingId, memoId, typology }),
      });
      const data = (await res.json()) as { risks?: RiskItem[] };
      // Use the risk at position i from the fresh batch so different cards get
      // different risks rather than every card always getting risks[0].
      const batch = data.risks ?? [];
      const replacement = batch[i] ?? batch[0];
      if (replacement) {
        updateRiskCard(i, {
          ...replacement,
          decision: "undecided",
          editing: false,
          editStatement: replacement.statement,
          editClassification: replacement.classification,
          editSeverity: replacement.severity,
          loadingDeep: false,
        });
      } else {
        updateRiskCard(i, { loadingDeep: false });
      }
    } catch {
      updateRiskCard(i, { loadingDeep: false });
    }
  }

  const allDecided = riskCards.length === 5 && riskCards.every((r) => r.decision !== "undecided");

  async function startScoring() {
    if (!allDecided || !memoId || !framingId || !typology) return;

    // Send ALL 5 risks regardless of decision so the DB preserves the full audit trail:
    // which risks the AI flagged and which the human approved vs. rejected.
    // Only approved risks (approved: true) are consumed by the scoring engine for P4.
    const approvedRisks = riskCards.map((r) => ({
      statement: r.statement,
      classification: r.classification,
      source: r.source,
      severity: r.severity,
      approved: r.decision === "approved",
    }));

    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memoId, framingId, typology, approvedRisks }),
      });
      const data = (await res.json()) as { eventId?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Score request failed");
      setEventId(data.eventId ?? null);
      setFlowStep("progress");
      startPolling(data.eventId ?? "");
    } catch (e) {
      setRiskError(e instanceof Error ? e.message : "Failed to start scoring");
    }
  }

  // ─── Progress polling ──────────────────────────────────────────────────────

  function startPolling(eid: string) {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const params = new URLSearchParams({ eventId: eid });
        if (memoId) params.set("memoId", String(memoId));
        const res = await fetch(`/api/score/progress?${params.toString()}`);
        const data = (await res.json()) as {
          status: "running" | "completed" | "failed";
          steps: StepStatus[];
          scoringRunId?: number;
        };
        setProgressSteps(data.steps ?? []);
        setProgressStatus(data.status);
        if (data.status === "completed") {
          clearInterval(pollingRef.current!);
          setFlowStep("done");
          if (data.scoringRunId) {
            router.push(`/scorecard/${data.scoringRunId}`);
          }
        } else if (data.status === "failed") {
          clearInterval(pollingRef.current!);
          setProgressError("Scoring run failed. Please try again.");
        }
      } catch {
        // keep polling
      }
    }, 2000);
  }

  // ─── Step labels ────────────────────────────────────────────────────────────

  const STEP_LABELS: Record<string, string> = {
    "load-inputs": "Loading inputs",
    "tier2-synthesis": "Synthesis",
    "tier3-p7": "Full-memo analysis (P7)",
    "server-scoring": "Computing scores",
    "confidence-status": "Deriving readiness",
    persist: "Saving results",
  };

  function getStepLabel(id: string, name: string): string {
    if (STEP_LABELS[id]) return STEP_LABELS[id];
    if (id.startsWith("tier1-chapter-")) {
      const idx = id.replace("tier1-chapter-", "");
      const chapter = memoChapters[parseInt(idx, 10)];
      return chapter ? `Chapter: ${chapter.title}` : `Chapter ${parseInt(idx, 10) + 1}`;
    }
    return name;
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const TYPOLOGY_OPTIONS: { key: Typology; label: string }[] = [
    { key: "ONE_A", label: "1A — External Investment" },
    { key: "ONE_B", label: "1B — Internal Initiative" },
    { key: "TWO_A", label: "2A — New Market Entry" },
    { key: "TWO_B", label: "2B — New Product Launch" },
  ];

  const classificationColor = (c: string) =>
    c === "BULL" ? "bg-green-100 text-green-800" :
    c === "BEAR" ? "bg-red-100 text-red-800" :
    "bg-amber-100 text-amber-800";

  const severityColor = (s: string) =>
    s === "CRITICAL" ? "bg-red-100 text-red-800" :
    s === "HIGH" ? "bg-amber-100 text-amber-800" :
    "bg-gray-100 text-gray-700";

  const statusIcon = (s: string) =>
    s === "completed" ? "✓" : s === "failed" ? "✗" : s === "running" ? "⟳" : "⏳";

  return (
    <>
      <TopBar title="Score Memo" />
      <main className="flex-1 p-6 max-w-3xl mx-auto">

        {/* ── STEP 1 ─ FRAMING ─────────────────────────────────────────────── */}
        {flowStep === "step1" && (
          <div>
            <StepTracker current={1} />
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-1">Step 1 — Framing Document</h2>
              <p className="text-sm text-gray-500 mb-5">
                Upload a .docx, .md, or .txt framing document, or paste your framing text.
              </p>

              {!framingPasteMode && !framingId && (
                <>
                  <UploadZone
                    accept=".docx,.md,.txt"
                    onFile={handleFramingFile}
                    label="Drag & drop your framing document here, or click to browse"
                  />
                  <button
                    onClick={() => setFramingPasteMode(true)}
                    className="mt-3 text-sm text-brand-orange underline"
                  >
                    Paste text instead
                  </button>
                </>
              )}

              {framingPasteMode && !framingId && (
                <div className="space-y-3">
                  <textarea
                    className="w-full h-40 border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-orange-ring"
                    placeholder="Paste your framing document here..."
                    value={framingPasteText}
                    onChange={(e) => setFramingPasteText(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleFramingPasteSubmit}
                      disabled={!framingPasteText.trim() || framingLoading}
                      className="px-4 py-2 bg-brand-orange text-white text-sm rounded-lg disabled:opacity-50"
                    >
                      {framingLoading ? "Saving..." : "Use this framing"}
                    </button>
                    <button
                      onClick={() => setFramingPasteMode(false)}
                      className="px-4 py-2 border border-gray-300 text-sm rounded-lg"
                    >
                      Upload instead
                    </button>
                  </div>
                </div>
              )}

              {framingLoading && (
                <p className="text-sm text-gray-500 mt-3">Processing...</p>
              )}
              {framingError && (
                <p className="text-sm text-red-600 mt-3">{framingError}</p>
              )}

              {framingId && (
                <div className="mt-4 space-y-2">
                  {/* T1 handoff banner: preselected framing with provenance + override */}
                  {handoff && (
                    <div className="flex flex-wrap items-center gap-2 bg-brand-orange-light border border-brand-orange-border rounded-lg px-3 py-2">
                      <span className="text-sm font-medium text-gray-800">{handoff.name}</span>
                      {handoff.revisionNumber !== null && handoff.parentName && (
                        <span className="text-xs text-gray-500">
                          revision {handoff.revisionNumber} of {handoff.parentName}
                        </span>
                      )}
                      <span className="text-xs rounded-full px-2 py-0.5 bg-white border border-brand-orange-border text-brand-orange font-medium">
                        from Sanity Check
                      </span>
                      <button
                        onClick={clearPreselectedFraming}
                        className="ml-auto text-xs text-gray-500 underline hover:text-gray-700"
                      >
                        Use a different framing
                      </button>
                    </div>
                  )}
                  {/* Framing gate chip (checker v1.2 — advisory: informational, never blocks) */}
                  {(() => {
                    if (!framingGate || framingGate.status === "not-run" || !framingGate.gateVerdict) {
                      return (
                        <span className="inline-block text-xs rounded-full px-3 py-1 bg-gray-100 border border-gray-300 text-gray-600">
                          Framing gate: not run
                        </span>
                      );
                    }
                    const v = framingGate.gateVerdict;
                    const style =
                      v === "BLOCKED"
                        ? "bg-red-100 border-red-300 text-red-800"
                        : v === "PASS_WITH_WARNINGS"
                        ? "bg-amber-100 border-amber-300 text-amber-800"
                        : "bg-green-100 border-green-300 text-green-800";
                    // Latest check's date shown so framings with multiple runs are unambiguous
                    const dateSuffix = framingGate.createdAt
                      ? ` · ${new Date(framingGate.createdAt).toLocaleDateString()}`
                      : "";
                    const label =
                      v === "BLOCKED"
                        ? `Framing gate: BLOCKED — ${framingGate.criticalCount ?? 0} Critical finding${(framingGate.criticalCount ?? 0) !== 1 ? "s" : ""}${dateSuffix}`
                        : v === "PASS_WITH_WARNINGS"
                        ? `Framing gate: pass with warnings${dateSuffix}`
                        : `Framing gate: PASS${dateSuffix}`;
                    return (
                      <a
                        href={`/sanity-check/${framingGate.sanityCheckId}`}
                        className={`inline-block text-xs rounded-full px-3 py-1 border hover:opacity-80 ${style}`}
                      >
                        {label}
                      </a>
                    );
                  })()}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Framing content</span>
                    {!framingEditing && !handoff && (
                      <button
                        onClick={() => { setFramingEditing(true); setFramingEditText(framingContent); }}
                        className="text-xs text-brand-orange underline"
                      >
                        ✏ Edit
                      </button>
                    )}
                    {handoff && (
                      <span
                        className="text-xs text-gray-400"
                        title="This framing has a checker verdict attached. Editing it here would orphan that verdict — use Save as revision on the Sanity Check page instead."
                      >
                        checked framing — edit via revision
                      </span>
                    )}
                  </div>
                  {framingEditing ? (
                    <textarea
                      autoFocus
                      className="w-full h-40 border border-brand-orange-ring rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-orange-ring"
                      value={framingEditText}
                      onChange={(e) => setFramingEditText(e.target.value)}
                      onBlur={handleFramingEditBlur}
                    />
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 h-40 overflow-y-auto whitespace-pre-wrap">
                      {framingContent.slice(0, 400)}{framingContent.length > 400 ? "…" : ""}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end mt-4">
              <button
                disabled={!framingId}
                onClick={() => setFlowStep("step2")}
                className="px-6 py-2 bg-brand-orange text-white rounded-lg font-medium disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2 ─ TYPOLOGY ────────────────────────────────────────────── */}
        {flowStep === "step2" && (
          <div>
            <StepTracker current={2} />
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-1">Step 2 — Typology</h2>
              <p className="text-sm text-gray-500 mb-5">Select the decision type for this memo.</p>
              <div className="grid grid-cols-2 gap-3">
                {TYPOLOGY_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setTypology(opt.key)}
                    className={`rounded-xl border-2 p-4 text-left transition-colors ${
                      typology === opt.key
                        ? "border-brand-orange bg-brand-orange-light"
                        : "border-gray-200 bg-white hover:border-brand-orange-ring"
                    }`}
                  >
                    <span className="font-semibold text-sm">{opt.label.split(" — ")[0]}</span>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.label.split(" — ")[1]}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-between mt-4">
              <button
                onClick={() => setFlowStep("step1")}
                className="px-6 py-2 border border-gray-300 rounded-lg text-sm"
              >
                Back
              </button>
              <button
                disabled={!typology}
                onClick={() => setFlowStep("step3")}
                className="px-6 py-2 bg-brand-orange text-white rounded-lg font-medium disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3 ─ MEMO ────────────────────────────────────────────────── */}
        {flowStep === "step3" && (
          <div>
            <StepTracker current={3} />
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-1">Step 3 — Decision Memo</h2>
              <p className="text-sm text-gray-500 mb-5">Upload or paste your decision memo.</p>

              {!memoPasteMode && !memoId && (
                <>
                  <UploadZone
                    accept=".docx,.md,.txt"
                    onFile={handleMemoFile}
                    label="Drag & drop your memo here, or click to browse"
                  />
                  <button
                    onClick={() => setMemoPasteMode(true)}
                    className="mt-3 text-sm text-brand-orange underline"
                  >
                    Paste text instead
                  </button>
                </>
              )}

              {memoPasteMode && !memoId && (
                <div className="space-y-3">
                  <input
                    type="text"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-ring"
                    placeholder="Memo name (required)"
                    value={memoPasteName}
                    onChange={(e) => setMemoPasteName(e.target.value)}
                  />
                  <textarea
                    className="w-full h-52 border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-orange-ring"
                    placeholder="Paste your decision memo here..."
                    value={memoPasteText}
                    onChange={(e) => setMemoPasteText(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleMemoPasteSubmit}
                      disabled={!memoPasteText.trim() || !memoPasteName.trim() || memoLoading}
                      className="px-4 py-2 bg-brand-orange text-white text-sm rounded-lg disabled:opacity-50"
                    >
                      {memoLoading ? "Saving..." : "Use this memo"}
                    </button>
                    <button
                      onClick={() => setMemoPasteMode(false)}
                      className="px-4 py-2 border border-gray-300 text-sm rounded-lg"
                    >
                      Upload instead
                    </button>
                  </div>
                </div>
              )}

              {memoLoading && <p className="text-sm text-gray-500 mt-3">Processing...</p>}
              {memoError && <p className="text-sm text-red-600 mt-3">{memoError}</p>}

              {memoId && (
                <div className="mt-4 space-y-4">
                  {/* Memo name */}
                  <div className="flex items-center gap-2">
                    {memoNameEditing ? (
                      <input
                        autoFocus
                        className="border border-brand-orange-ring rounded px-2 py-1 text-sm focus:outline-none"
                        value={memoName}
                        onChange={(e) => setMemoName(e.target.value)}
                        onBlur={() => setMemoNameEditing(false)}
                      />
                    ) : (
                      <>
                        <span className="font-medium text-sm">{memoName}</span>
                        <button
                          onClick={() => setMemoNameEditing(true)}
                          className="text-xs text-brand-orange underline"
                        >
                          ✏
                        </button>
                      </>
                    )}
                  </div>

                  {/* Chapter list */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      {memoChapters.length} chapter{memoChapters.length !== 1 ? "s" : ""} detected
                    </p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {memoChapters.map((ch) => (
                        <div
                          key={ch.index}
                          className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg text-sm"
                        >
                          <span className="flex-1 text-gray-700">{ch.title}</span>
                          {!ch.scored && (
                            <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
                              context only
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between mt-4">
              <button
                onClick={() => setFlowStep("step2")}
                className="px-6 py-2 border border-gray-300 rounded-lg text-sm"
              >
                Back
              </button>
              <button
                disabled={!memoId}
                onClick={generateRisks}
                className="px-6 py-2 bg-brand-orange text-white rounded-lg font-medium disabled:opacity-50"
              >
                Next — Review Risks
              </button>
            </div>
          </div>
        )}

        {/* ── RISK GATE ─────────────────────────────────────────────────────── */}
        {flowStep === "risk-gate" && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Risk Review Gate</h2>

            {riskCaveat && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 mb-5">
                {riskCaveat}
              </div>
            )}

            {riskLoading && (
              <div className="flex items-center gap-3 py-12 justify-center">
                <div className="w-8 h-8 border-4 border-brand-orange-border border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-500">Generating risks...</span>
              </div>
            )}

            {riskError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                {riskError}
              </div>
            )}

            {!riskLoading && riskCards.length > 0 && (
              <div className="space-y-4">
                {riskCards.map((card, i) => (
                  <div
                    key={i}
                    className={`bg-white border-2 rounded-xl p-5 shadow-sm transition-colors ${
                      card.decision === "approved"
                        ? "border-green-400"
                        : card.decision === "rejected"
                        ? "border-red-300 opacity-60"
                        : "border-gray-200"
                    }`}
                  >
                    {card.editing ? (
                      <div className="space-y-3">
                        {/* Statement */}
                        <div>
                          <label className="text-xs text-gray-500 font-medium mb-1 block">Risk statement</label>
                          <textarea
                            className="w-full border border-brand-orange-ring rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-orange-ring"
                            value={card.editStatement}
                            onChange={(e) => updateRiskCard(i, { editStatement: e.target.value })}
                            rows={3}
                          />
                        </div>
                        {/* Classification + Severity side by side */}
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="text-xs text-gray-500 font-medium mb-1 block">Classification</label>
                            <select
                              value={card.editClassification}
                              onChange={(e) =>
                                updateRiskCard(i, {
                                  editClassification: e.target.value as "BULL" | "BEAR" | "BILATERAL",
                                })
                              }
                              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
                            >
                              <option value="BULL">BULL — upside risk</option>
                              <option value="BEAR">BEAR — downside risk</option>
                              <option value="BILATERAL">BILATERAL — cuts both ways</option>
                            </select>
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-gray-500 font-medium mb-1 block">Severity</label>
                            <select
                              value={card.editSeverity}
                              onChange={(e) =>
                                updateRiskCard(i, {
                                  editSeverity: e.target.value as "CRITICAL" | "HIGH" | "MEDIUM",
                                })
                              }
                              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
                            >
                              <option value="CRITICAL">CRITICAL</option>
                              <option value="HIGH">HIGH</option>
                              <option value="MEDIUM">MEDIUM</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              updateRiskCard(i, {
                                // Commit all three edited fields back to the card
                                statement: card.editStatement,
                                classification: card.editClassification,
                                severity: card.editSeverity,
                                editing: false,
                                decision: "approved",
                              })
                            }
                            className="px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg"
                          >
                            Save & Approve
                          </button>
                          <button
                            onClick={() => updateRiskCard(i, { editing: false })}
                            className="px-3 py-1.5 border border-gray-300 text-sm rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="font-semibold text-sm mb-3">{card.statement}</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${classificationColor(card.classification)}`}
                          >
                            {card.classification}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {card.source}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityColor(card.severity)}`}
                          >
                            {card.severity}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 italic mb-4">
                          Why this might NOT be a risk: {card.whyNotARisk}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => updateRiskCard(i, { decision: "approved" })}
                            className="px-3 py-1.5 border-2 border-green-500 text-green-700 text-sm rounded-lg hover:bg-green-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => updateRiskCard(i, { decision: "rejected" })}
                            className="px-3 py-1.5 border-2 border-red-400 text-red-600 text-sm rounded-lg hover:bg-red-50"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() =>
                              updateRiskCard(i, {
                                editing: true,
                                editStatement: card.statement,
                                editClassification: card.classification,
                                editSeverity: card.severity,
                              })
                            }
                            className="px-3 py-1.5 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
                          >
                            ✏ Edit
                          </button>
                          <button
                            onClick={() => deepReview(i)}
                            disabled={card.loadingDeep}
                            className="px-3 py-1.5 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
                          >
                            {card.loadingDeep ? "Reviewing..." : "Need deeper review"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}

                <button
                  disabled={!allDecided}
                  onClick={startScoring}
                  className="w-full py-3 bg-brand-orange text-white font-semibold rounded-xl disabled:opacity-50 mt-4"
                >
                  Start Scoring
                </button>
                {!allDecided && (
                  <p className="text-xs text-center text-gray-400">
                    Approve or reject all 5 risks to continue.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── PROGRESS ─────────────────────────────────────────────────────── */}
        {flowStep === "progress" && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Scoring in progress...</h2>
            <p className="text-sm text-gray-500 mb-6">
              Event ID: <code className="font-mono text-xs">{eventId}</code>
            </p>

            {progressError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-sm text-red-700">
                {progressError}
                <button
                  onClick={() => { setFlowStep("step1"); }}
                  className="ml-3 underline text-red-600"
                >
                  Try again
                </button>
              </div>
            )}

            <div className="space-y-2">
              {progressSteps.length === 0 && (
                <div className="flex items-center gap-3 py-8 justify-center">
                  <div className="w-6 h-6 border-4 border-brand-orange-border border-t-transparent rounded-full animate-spin" />
                  <span className="text-gray-500 text-sm">Waiting for scoring pipeline...</span>
                </div>
              )}
              {progressSteps.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-2.5"
                >
                  <span className={`text-base ${
                    s.status === "completed" ? "text-green-500" :
                    s.status === "failed" ? "text-red-500" :
                    s.status === "running" ? "text-brand-orange animate-spin" :
                    "text-gray-300"
                  }`}>
                    {statusIcon(s.status)}
                  </span>
                  <span className="text-sm text-gray-700">{getStepLabel(s.id, s.name)}</span>
                  <span className={`ml-auto text-xs ${
                    s.status === "completed" ? "text-green-600" :
                    s.status === "failed" ? "text-red-600" :
                    s.status === "running" ? "text-brand-orange" :
                    "text-gray-400"
                  }`}>
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </>
  );
}
