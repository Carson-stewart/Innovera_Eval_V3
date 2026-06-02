"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shell/TopBar";

// ─── Types ────────────────────────────────────────────────────────────────────

type Typology = "ONE_A" | "ONE_B" | "TWO_A" | "TWO_B";
type InputMode = "upload" | "paste" | "existing";
type FlowStep = "input" | "progress" | "done";

interface ExistingFraming {
  id: number;
  name: string;
  typology: Typology | null;
  sourceType: string;
  createdAt: string;
  content: string;
}

interface PassStatus {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
}

const TYPOLOGY_OPTIONS: { key: Typology; label: string; desc: string }[] = [
  { key: "ONE_A", label: "1A", desc: "External Investment" },
  { key: "ONE_B", label: "1B", desc: "Internal Initiative" },
  { key: "TWO_A", label: "2A", desc: "New Market Entry" },
  { key: "TWO_B", label: "2B", desc: "New Product Launch" },
];

const PASSES: { id: string; label: string }[] = [
  { id: "pass0", label: "Pass 0: Structure" },
  { id: "pass1", label: "Pass 1: Logical Integrity" },
  { id: "pass2", label: "Pass 2: Completeness" },
  { id: "pass3", label: "Pass 3: Structural" },
  { id: "pass4", label: "Pass 4: Rule Compliance" },
];

// ─── Upload Zone ──────────────────────────────────────────────────────────────

function UploadZone({ onFile }: { onFile: (f: File) => void }) {
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
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
        dragging
          ? "border-brand-orange-border bg-brand-orange-light"
          : "border-gray-300 hover:border-brand-orange-ring bg-white"
      }`}
    >
      <div className="text-gray-400 mb-2 text-3xl">&#8679;</div>
      <p className="text-sm text-gray-600 font-medium">
        Drag & drop your framing document here
      </p>
      <p className="text-xs text-gray-400 mt-1">
        .docx, .md, or .txt — or click to browse
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".docx,.md,.txt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </div>
  );
}

// ─── Status icon ──────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: PassStatus["status"] }) {
  if (status === "completed")
    return <span className="text-green-500 font-bold">&#10003;</span>;
  if (status === "failed")
    return <span className="text-red-500 font-bold">&#10007;</span>;
  if (status === "running")
    return (
      <span className="inline-block w-4 h-4 border-2 border-brand-orange-border border-t-transparent rounded-full animate-spin" />
    );
  return <span className="text-gray-300">&#9679;</span>;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function UploadFramingPage() {
  const router = useRouter();

  // Input mode
  const [inputMode, setInputMode] = useState<InputMode>("upload");

  // Framing state
  const [framingId, setFramingId] = useState<number | null>(null);
  const [framingContent, setFramingContent] = useState("");
  const [framingEditing, setFramingEditing] = useState(false);
  const [framingEditText, setFramingEditText] = useState("");
  const [framingName, setFramingName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Paste mode state
  const [pasteText, setPasteText] = useState("");
  const [pasteName, setPasteName] = useState("");

  // Existing framings
  const [existingFramings, setExistingFramings] = useState<ExistingFraming[]>([]);
  const [existingLoading, setExistingLoading] = useState(false);
  const [selectedExistingId, setSelectedExistingId] = useState<number | null>(null);

  // Typology
  const [typology, setTypology] = useState<Typology | "auto">("auto");

  // Flow
  const [flowStep, setFlowStep] = useState<FlowStep>("input");
  const [eventId, setEventId] = useState<string | null>(null);
  const [passes, setPasses] = useState<PassStatus[]>(
    PASSES.map((p) => ({ id: p.id, name: p.label, status: "pending" }))
  );
  const [progressError, setProgressError] = useState("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load existing framings when that tab is selected
  useEffect(() => {
    if (inputMode === "existing" && existingFramings.length === 0) {
      loadExistingFramings();
    }
  }, [inputMode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadExistingFramings() {
    setExistingLoading(true);
    try {
      const res = await fetch("/api/framing-list");
      const data = (await res.json()) as { framings?: ExistingFraming[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setExistingFramings(data.framings ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load framings");
    } finally {
      setExistingLoading(false);
    }
  }

  // ─── Input handlers ─────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/framing/upload", { method: "POST", body: fd });
      const data = (await res.json()) as {
        framingId?: number;
        content?: string;
        name?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setFramingId(data.framingId ?? null);
      setFramingContent(data.content ?? "");
      setFramingEditText(data.content ?? "");
      setFramingName(data.name ?? file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasteSubmit() {
    if (!pasteText.trim() || !pasteName.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/framing/paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: pasteText,
          name: pasteName,
          typology: typology === "auto" ? undefined : typology,
        }),
      });
      const data = (await res.json()) as {
        framingId?: number;
        content?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Paste failed");
      setFramingId(data.framingId ?? null);
      setFramingContent(data.content ?? pasteText);
      setFramingEditText(data.content ?? pasteText);
      setFramingName(pasteName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Paste failed");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectExisting(f: ExistingFraming) {
    setSelectedExistingId(f.id);
    setFramingId(f.id);
    setFramingContent(f.content);
    setFramingEditText(f.content);
    setFramingName(f.name);
    if (f.typology && typology === "auto") {
      setTypology(f.typology);
    }
  }

  async function saveFramingEdit() {
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
      // best-effort save
    }
    setFramingEditing(false);
  }

  function resetInput() {
    setFramingId(null);
    setFramingContent("");
    setFramingEditText("");
    setFramingName("");
    setSelectedExistingId(null);
    setError("");
    setPasteText("");
    setPasteName("");
  }

  // ─── Run sanity check ────────────────────────────────────────────────────────

  async function runSanityCheck() {
    if (!framingId) return;
    setProgressError("");
    setPasses(PASSES.map((p) => ({ id: p.id, name: p.label, status: "pending" })));
    setFlowStep("progress");

    try {
      const res = await fetch("/api/sanity-check/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          framingDocId: framingId,          // API expects framingDocId
          typology: typology === "auto" ? undefined : typology,
          content: framingContent,
        }),
      });
      const data = (await res.json()) as { eventId?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to start sanity check");
      setEventId(data.eventId ?? null);
      startPolling(data.eventId ?? "");
    } catch (e) {
      setProgressError(e instanceof Error ? e.message : "Failed to start sanity check");
      setFlowStep("input");
    }
  }

  // ─── Progress polling ────────────────────────────────────────────────────────

  function startPolling(eid: string) {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/sanity-check/progress?eventId=${encodeURIComponent(eid)}`
        );
        const data = (await res.json()) as {
          status: "running" | "completed" | "failed";
          passes?: PassStatus[];
          sanityCheckId?: number;
          error?: string;
        };

        if (data.passes) {
          setPasses(data.passes);
        }

        if (data.status === "completed") {
          clearInterval(pollingRef.current!);
          setFlowStep("done");
          if (data.sanityCheckId) {
            router.push(`/sanity-check/${data.sanityCheckId}`);
          }
        } else if (data.status === "failed") {
          clearInterval(pollingRef.current!);
          setProgressError(data.error ?? "Sanity check failed. Please try again.");
        }
      } catch {
        // keep polling on transient network errors
      }
    }, 2000);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const canRun = !!framingId && framingContent.trim().length > 0;

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <TopBar title="Upload Framing" />
      <main className="flex-1 p-6 max-w-3xl mx-auto">

        {/* ── INPUT STEP ───────────────────────────────────────────────────────── */}
        {flowStep === "input" && (
          <div className="space-y-6">

            {/* Input mode tabs */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="flex border-b border-gray-200">
                {(["upload", "paste", "existing"] as InputMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      if (!framingId) setInputMode(mode);
                    }}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors capitalize ${
                      inputMode === mode
                        ? "border-b-2 border-brand-orange text-brand-orange bg-brand-orange-light"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    } ${framingId && inputMode !== mode ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    {mode === "upload"
                      ? "Upload File"
                      : mode === "paste"
                      ? "Paste Text"
                      : "Select Existing"}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {/* ── Upload tab ── */}
                {inputMode === "upload" && !framingId && (
                  <div>
                    <UploadZone onFile={handleFile} />
                    {loading && (
                      <p className="text-sm text-gray-500 mt-3 text-center">
                        Processing file...
                      </p>
                    )}
                    {error && (
                      <p className="text-sm text-red-600 mt-3">{error}</p>
                    )}
                  </div>
                )}

                {/* ── Paste tab ── */}
                {inputMode === "paste" && !framingId && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Framing name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange-ring"
                        placeholder="e.g. Acme Corp — Series A Investment Framing"
                        value={pasteName}
                        onChange={(e) => setPasteName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Framing text <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        className="w-full h-52 border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-orange-ring"
                        placeholder="Paste your decision framing document here..."
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handlePasteSubmit}
                        disabled={
                          !pasteText.trim() || !pasteName.trim() || loading
                        }
                        className="px-4 py-2 bg-brand-orange text-white text-sm rounded-lg font-medium disabled:opacity-50 hover:bg-brand-orange-hover transition-colors"
                      >
                        {loading ? "Saving..." : "Use this framing"}
                      </button>
                    </div>
                    {error && (
                      <p className="text-sm text-red-600">{error}</p>
                    )}
                  </div>
                )}

                {/* ── Existing tab ── */}
                {inputMode === "existing" && !framingId && (
                  <div>
                    {existingLoading && (
                      <div className="flex items-center justify-center py-8 gap-3">
                        <div className="w-5 h-5 border-2 border-brand-orange-border border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-gray-500">Loading framings...</span>
                      </div>
                    )}
                    {!existingLoading && existingFramings.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-8">
                        No framings found. Upload or paste one first.
                      </p>
                    )}
                    {!existingLoading && existingFramings.length > 0 && (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {existingFramings.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => handleSelectExisting(f)}
                            className={`w-full text-left rounded-lg border-2 px-4 py-3 transition-colors ${
                              selectedExistingId === f.id
                                ? "border-brand-orange bg-brand-orange-light"
                                : "border-gray-200 hover:border-brand-orange-ring bg-white"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-800 truncate max-w-xs">
                                {f.name}
                              </span>
                              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                                {f.typology && (
                                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                    {f.typology.replace("_", "")}
                                  </span>
                                )}
                                <span className="text-xs text-gray-400">
                                  {formatDate(f.createdAt)}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                              {f.content.slice(0, 120)}...
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                    {error && (
                      <p className="text-sm text-red-600 mt-3">{error}</p>
                    )}
                  </div>
                )}

                {/* ── Loaded framing preview (all modes) ── */}
                {framingId && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold text-gray-800">
                          {framingName}
                        </span>
                        <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          Ready
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {!framingEditing && (
                          <button
                            onClick={() => {
                              setFramingEditing(true);
                              setFramingEditText(framingContent);
                            }}
                            className="text-xs text-brand-orange underline"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          onClick={resetInput}
                          className="text-xs text-gray-400 underline hover:text-gray-600"
                        >
                          Change
                        </button>
                      </div>
                    </div>

                    {framingEditing ? (
                      <div className="space-y-2">
                        <textarea
                          autoFocus
                          className="w-full h-52 border border-brand-orange-ring rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-orange-ring"
                          value={framingEditText}
                          onChange={(e) => setFramingEditText(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={saveFramingEdit}
                            className="px-3 py-1.5 bg-brand-orange text-white text-sm rounded-lg hover:bg-brand-orange-hover"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setFramingEditing(false);
                              setFramingEditText(framingContent);
                            }}
                            className="px-3 py-1.5 border border-gray-300 text-sm rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                        {framingContent.slice(0, 600)}
                        {framingContent.length > 600 && (
                          <span className="text-gray-400">
                            {" "}... ({framingContent.length - 600} more chars)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Typology selector ───────────────────────────────────────────── */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-1">
                Typology
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                Select the decision type, or let the system auto-detect from the
                framing.
              </p>
              <div className="grid grid-cols-5 gap-2">
                <button
                  onClick={() => setTypology("auto")}
                  className={`rounded-lg border-2 p-3 text-center transition-colors ${
                    typology === "auto"
                      ? "border-brand-orange bg-brand-orange-light"
                      : "border-gray-200 hover:border-brand-orange-ring bg-white"
                  }`}
                >
                  <span className="block text-sm font-semibold text-gray-700">
                    Auto
                  </span>
                  <span className="block text-xs text-gray-400 mt-0.5">
                    Detect
                  </span>
                </button>
                {TYPOLOGY_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setTypology(opt.key)}
                    className={`rounded-lg border-2 p-3 text-center transition-colors ${
                      typology === opt.key
                        ? "border-brand-orange bg-brand-orange-light"
                        : "border-gray-200 hover:border-brand-orange-ring bg-white"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-gray-700">
                      {opt.label}
                    </span>
                    <span className="block text-xs text-gray-400 mt-0.5">
                      {opt.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Run button ───────────────────────────────────────────────────── */}
            {progressError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                {progressError}
              </div>
            )}

            <div className="flex justify-end">
              <button
                disabled={!canRun}
                onClick={runSanityCheck}
                className="px-8 py-3 bg-brand-orange text-white font-semibold rounded-xl disabled:opacity-50 hover:bg-brand-orange-hover transition-colors shadow-sm"
              >
                Run Sanity Check
              </button>
            </div>
          </div>
        )}

        {/* ── PROGRESS STEP ────────────────────────────────────────────────────── */}
        {(flowStep === "progress" || flowStep === "done") && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {flowStep === "done" ? "Sanity check complete" : "Running sanity check..."}
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {framingName}
                    {eventId && (
                      <span className="ml-3 font-mono text-xs text-gray-400">
                        {eventId}
                      </span>
                    )}
                  </p>
                </div>
                {flowStep === "progress" && (
                  <div className="w-6 h-6 border-2 border-brand-orange-border border-t-transparent rounded-full animate-spin flex-shrink-0 mt-1" />
                )}
                {flowStep === "done" && (
                  <span className="w-7 h-7 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold text-base flex-shrink-0">
                    &#10003;
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {passes.map((pass, i) => {
                  const label = PASSES[i]?.label ?? pass.name;
                  return (
                    <div
                      key={pass.id}
                      className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                        pass.status === "running"
                          ? "border-brand-orange-ring bg-brand-orange-light"
                          : pass.status === "completed"
                          ? "border-green-200 bg-green-50"
                          : pass.status === "failed"
                          ? "border-red-200 bg-red-50"
                          : "border-gray-100 bg-gray-50"
                      }`}
                    >
                      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                        <StatusIcon status={pass.status} />
                      </div>
                      <span
                        className={`text-sm font-medium ${
                          pass.status === "running"
                            ? "text-brand-orange-hover"
                            : pass.status === "completed"
                            ? "text-green-700"
                            : pass.status === "failed"
                            ? "text-red-700"
                            : "text-gray-500"
                        }`}
                      >
                        {label}
                      </span>
                      <span
                        className={`ml-auto text-xs capitalize ${
                          pass.status === "running"
                            ? "text-brand-orange"
                            : pass.status === "completed"
                            ? "text-green-600"
                            : pass.status === "failed"
                            ? "text-red-600"
                            : "text-gray-400"
                        }`}
                      >
                        {pass.status}
                      </span>
                    </div>
                  );
                })}
              </div>

              {progressError && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                  {progressError}
                  <button
                    onClick={() => {
                      setFlowStep("input");
                      setProgressError("");
                    }}
                    className="ml-3 underline text-red-600"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>

            {flowStep === "done" && (
              <p className="text-sm text-center text-gray-400">
                Redirecting to results...
              </p>
            )}
          </div>
        )}

      </main>
    </>
  );
}
