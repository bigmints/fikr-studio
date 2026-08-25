"use client";

import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft, RefreshCw, Sparkles, BookOpen, Clock, ChevronDown,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import type {
  StudioProject, GenerateParams, Citation,
} from "@/lib/generate/types";
import { StudioRichEditor } from "./studio-rich-editor";
import { ArtifactDrawer } from "./artifact-drawer";
import { VersionHistoryDrawer } from "./version-history-drawer";
import PRESETS from "@/lib/generate/presets.json";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ── Generating messages ────────────────────────────────────────────────────────
const MSGS = [
  "Connecting the dots in your notes…",
  "Cross-referencing ideas and insights…",
  "Crafting your narrative arc…",
  "Writing the opening hook…",
  "Building the core argument…",
  "Adding depth from your insights…",
  "Structuring for your audience…",
  "Polishing the language…",
  "Almost there…",
];

// ── Compact slider ─────────────────────────────────────────────────────────────
function ParamSlider({
  label, leftLabel, rightLabel, value, onChange, disabled,
}: {
  label: string; leftLabel: string; rightLabel: string;
  value: number; onChange: (v: number) => void; disabled?: boolean;
}) {
  const semanticValue = value < 34 ? leftLabel : value > 66 ? rightLabel : "Balanced";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-baseline">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="text-xs font-medium text-muted-foreground">{semanticValue}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <input
          type="range" min={0} max={100} value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          aria-valuetext={semanticValue}
          className="studio-slider w-full"
          style={{
            opacity: disabled ? 0.5 : 1,
            background: `linear-gradient(to right, var(--foreground) 0%, var(--foreground) ${value}%, color-mix(in oklch, var(--foreground) 12%, transparent) ${value}%, color-mix(in oklch, var(--foreground) 12%, transparent) 100%)`,
          }}
        />
        <div className="flex justify-between items-center px-0.5">
          <span className="text-xs text-muted-foreground/70">{leftLabel}</span>
          <span className="text-xs text-muted-foreground/70">{rightLabel}</span>
        </div>
      </div>
    </div>
  );
}

function cleanMarkdown(raw: string): string {
  let cleaned = raw.trim();

  // Strip leading LLM meta-commentary preambles (any variant):
  // "**Note:** Since no topic was specified…"
  // "*Note: Since no topic…*"
  // "Note: …"
  // "(Note: …)"
  // "(This is an expert-level post on…)"
  // Matches up to the first blank line or H1 heading — whichever comes first.
  cleaned = cleaned
    // Parenthesised preambles: (…)
    .replace(/^\s*\([^)]*\)\s*\n*/m, "")
    // Curly-brace preambles: {…}
    .replace(/^\s*\{[^{]*?\}\s*\n*/m, "")
    // Bold/italic Note: preamble spanning one or two sentences
    .replace(/^\s*\*{0,2}Note\s*:\s*\*{0,2}[^\n]+\n*/i, "")
    // Plain "Note:" lines
    .replace(/^\s*Note\s*:\s*[^\n]+\n*/i, "")
    // "Since no topic was specified" openers
    .replace(/^\s*Since no topic was specified[^\n]+\n*/i, "")
    // "I have written" openers
    .replace(/^\s*I have written[^\n]+\n*/i, "")
    // "Here is" / "Here's" openers that aren't content headings
    .replace(/^\s*Here(?:'s| is) (?:an?|the) [^\n]{0,80}\n*/i, "")
    // Markdown italic preamble lines: *…*
    .replace(/^\s*\*[^*\n]{10,200}\*\s*\n+/m, "");

  return cleaned.trim();
}

interface Props {
  project: StudioProject;
  params:  GenerateParams;
  onBack:  () => void;
  onRegenerate:   (params: GenerateParams) => void;
  onUpdateParams: (patch: Partial<GenerateParams>) => void;
  onHighlightNote?: (noteId: string) => void;
  onSaveVersion?: (label: string, markdown: string, isManual: boolean) => void;
  onRevertToVersion?: (versionId: string, currentMarkdown: string) => void;
}

export function StudioGenerateView({
  project, params, onBack, onRegenerate, onUpdateParams, onHighlightNote,
  onSaveVersion, onRevertToVersion,
}: Props) {
  const rawMarkdown = project.outputMarkdown ?? "";
  const [markdown, setMarkdown] = useState(() => cleanMarkdown(rawMarkdown));
  const [citations] = useState<Citation[]>(project.citations ?? []);
  const [showSources, setShowSources] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [writingOpen, setWritingOpen] = useState(false);

  const [tone,     setTone]     = useState(params.tone     ?? 50);
  const [depth,    setDepth]    = useState(params.depth    ?? 50);
  const [audience, setAudience] = useState(params.audience ?? 50);

  const [presetId, setPresetId] = useState<string>(params.presetId ?? PRESETS[0].id);
  const [maxLength, setMaxLength] = useState<number>(params.maxLength ?? PRESETS[0].maxLength);
  const [enableHashtags, setEnableHashtags] = useState<boolean>(params.enableHashtags ?? PRESETS[0].enableHashtags);

  const handlePresetChange = (pid: string) => {
    const p = PRESETS.find(x => x.id === pid);
    if (!p) return;
    setPresetId(p.id);
    setMaxLength(p.maxLength);
    setEnableHashtags(p.enableHashtags);
    handleParamChange({ presetId: p.id, maxLength: p.maxLength, enableHashtags: p.enableHashtags });
  };

  const [msgIdx, setMsgIdx] = useState(0);
  const [msgVisible, setMsgVisible] = useState(true);
  const msgTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (project.status !== "generating") {
      if (msgTimer.current) clearInterval(msgTimer.current);
      return;
    }
    msgTimer.current = setInterval(() => {
      setMsgVisible(false);
      setTimeout(() => { setMsgIdx((i) => (i + 1) % MSGS.length); setMsgVisible(true); }, 400);
    }, 3200);
    return () => { if (msgTimer.current) clearInterval(msgTimer.current); };
  }, [project.status]);

  useEffect(() => { setMarkdown(cleanMarkdown(project.outputMarkdown ?? "")); }, [project.outputMarkdown]);
  useEffect(() => { setTone(params.tone ?? 50); setDepth(params.depth ?? 50); setAudience(params.audience ?? 50); }, [params.tone, params.depth, params.audience]);
  // Sync preset params when the active project changes (defensive — key prop handles the normal case)
  useEffect(() => {
    setPresetId(params.presetId ?? PRESETS[0].id);
    setMaxLength(params.maxLength ?? PRESETS[0].maxLength);
    setEnableHashtags(params.enableHashtags ?? PRESETS[0].enableHashtags);
  }, [params.presetId, params.maxLength, params.enableHashtags]);

  const wordCount = markdown ? markdown.trim().split(/\s+/).filter(Boolean).length : 0;
  const isGenerating = project.status === "generating";
  const isDone = (project.status === "done" || project.status === "published") && !!markdown;
  const isError = !isGenerating && !isDone;

  const currentParams: GenerateParams = { ...params, tone, depth, audience, presetId, maxLength, enableHashtags };

  const handleParamChange = (patch: Partial<GenerateParams>) => {
    if (patch.tone     !== undefined) setTone(patch.tone);
    if (patch.depth    !== undefined) setDepth(patch.depth);
    if (patch.audience !== undefined) setAudience(patch.audience);
    if (patch.presetId !== undefined) setPresetId(patch.presetId);
    if (patch.maxLength !== undefined) setMaxLength(patch.maxLength);
    if (patch.enableHashtags !== undefined) setEnableHashtags(patch.enableHashtags);
    onUpdateParams(patch);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden", background: "var(--background)" }}>

      {/* ── Top Toolbar ── */}
      <header className="studio-toolbar">
        <div className="studio-toolbar__left">
          <button onClick={onBack} className="studio-icon-btn" title="Back to project">
            <ArrowLeft className="size-4" />
          </button>
          <div className="studio-toolbar__divider" />
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.2 }}>{project.name}</span>
          </div>
        </div>
        <div className="studio-toolbar__right" style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className={`studio-pill-btn !text-xs ${showHistory ? "active" : ""}`}
            title="Version History"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Clock className="size-3.5" />
            <span>History</span>
          </button>
          {isDone && (
            <>
              <button
                onClick={() => onRegenerate(currentParams)}
                className="flex h-8 items-center gap-1.5 rounded-md border border-border/50 bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
              >
                <RefreshCw className="size-3.5" />
                Regenerate
              </button>
              <button
                onClick={() => setShowDrawer(true)}
                disabled={wordCount > maxLength}
                className="flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-xs font-semibold text-background transition-opacity hover:opacity-85 disabled:pointer-events-none disabled:opacity-40"
                title={wordCount > maxLength ? "Reduce the article length before publishing" : "Prepare article for publishing"}
              >
                <BookOpen className="size-3.5" />
                Prepare to publish
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden", position: "relative" }}>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* GENERATING */}
          {isGenerating && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 48 }}>
              <div className="flex items-center justify-center w-12 h-12 rounded-full border border-border/50 shadow-sm shimmer-body mb-2">
                <Sparkles className="size-5 text-foreground" />
              </div>
              <p className="text-sm font-semibold shimmer-text" style={{ transition: "opacity 0.4s", opacity: msgVisible ? 1 : 0, minHeight: 24, textAlign: "center" }}>
                {MSGS[msgIdx]}
              </p>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--muted-foreground)", maxWidth: 320, textAlign: "center", lineHeight: 1.6 }}>
                The AI is writing your article. This usually takes 15–45 seconds.
              </p>
              <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {[[65, 20], [100, 12], [88, 12], [95, 12], [0, 0], [42, 18], [100, 12], [78, 12]].map(([w, h], idx) =>
                  h ? (
                    <div key={idx} className="shimmer-body" style={{ height: h, width: `${w}%`, borderRadius: 6 }} />
                  ) : <div key={idx} style={{ height: 6 }} />
                )}
              </div>
            </div>
          )}

          {/* ERROR */}
          {!isGenerating && isError && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 48, textAlign: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#ef4444", fontWeight: 700, fontSize: "var(--text-lg)" }}>!</span>
              </div>
              <p style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>Generation failed</p>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--muted-foreground)", maxWidth: 340, lineHeight: 1.6 }}>
                {project.error || "The AI model produced no output. Try adjusting your parameters."}
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button onClick={() => onRegenerate(currentParams)} className="studio-btn-primary !rounded-md !text-xs">Retry</button>
              </div>
            </div>
          )}

          {/* DONE — Editor */}
          {!isGenerating && isDone && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <div style={{ maxWidth: 740, margin: "0 auto", padding: "24px 48px 120px" }}>

                <StudioRichEditor content={markdown} onUpdate={setMarkdown} maxLength={maxLength} />

                {/* Citations */}
                {showSources && citations.length > 0 && (
                  <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
                    <p className="mb-3 text-xs font-semibold text-foreground">Sources from your notes</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {citations.map((c) => (
                        <button
                          key={c.index}
                          onClick={() => onHighlightNote?.(c.noteId)}
                          style={{
                            display: "flex", alignItems: "flex-start", gap: 10, textAlign: "left",
                            padding: "8px 12px", borderRadius: 8,
                            border: "1px solid color-mix(in oklch, var(--border) 50%, transparent)",
                            background: "var(--card)", cursor: "pointer", transition: "border-color 0.15s",
                          }}
                        >
                          <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--foreground)", minWidth: 20 }}>[{c.index}]</span>
                          <p style={{ fontSize: "var(--text-xs)", color: "var(--muted-foreground)", lineHeight: 1.5, margin: 0 }}>{c.notePreview}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Right parameters rail ─────────────────────────────────────────── */}
        {(isDone || isGenerating) && (
          <div className="studio-params-rail">

            <div className="studio-params-section">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Words</span>
                <span className={wordCount > maxLength ? "font-semibold text-red-500" : "font-medium text-foreground"}>
                  {wordCount.toLocaleString()} / {maxLength.toLocaleString()}
                </span>
              </div>
              {wordCount > maxLength && (
                <p className="mt-2 text-xs leading-5 text-red-500">Reduce the article length before publishing.</p>
              )}
            </div>

            {/* Writing controls stay available without permanently dominating the editor. */}
            <div className="studio-params-section">
              <button
                type="button"
                onClick={() => setWritingOpen((open) => !open)}
                className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left text-sm font-semibold text-foreground transition-colors hover:bg-secondary/50"
                aria-expanded={writingOpen}
              >
                <span>Writing</span>
                <ChevronDown className={`size-4 text-muted-foreground transition-transform ${writingOpen ? "rotate-180" : ""}`} />
              </button>
              <p className="mt-1 px-1 text-xs text-muted-foreground">
                {PRESETS.find((preset) => preset.id === presetId)?.name ?? "Custom"} · {tone < 34 ? "Professional" : tone > 66 ? "Conversational" : "Balanced"}
              </p>

              {writingOpen && (
                <div className="mt-4 flex flex-col gap-5">
                  <label className="flex flex-col gap-2 text-xs font-medium text-foreground">
                    Preset
                    <Select value={presetId} onValueChange={handlePresetChange} disabled={isGenerating}>
                      <SelectTrigger aria-label="Writing preset" className="h-8 border-border/50 px-2 text-xs font-normal">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="start">
                        {PRESETS.map((preset) => <SelectItem key={preset.id} value={preset.id}>{preset.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </label>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between text-xs">
                      <label htmlFor="studio-max-words" className="font-medium text-foreground">Maximum words</label>
                      <input
                        id="studio-max-words"
                        type="number"
                        value={maxLength}
                        onChange={(event) => {
                          const nextLength = parseInt(event.target.value) || 0;
                          handleParamChange({ maxLength: nextLength });
                        }}
                        className="h-7 w-20 rounded-md border border-border/50 bg-background px-2 text-right text-xs text-foreground outline-none focus:border-foreground/40"
                        disabled={isGenerating}
                      />
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={enableHashtags}
                        onChange={(event) => handleParamChange({ enableHashtags: event.target.checked })}
                        disabled={isGenerating}
                        className="accent-foreground"
                      />
                      Include hashtags
                    </label>
                  </div>

                  {(params.topicTitle || params.customPrompt) && (
                    <div>
                      <span className="text-xs font-medium text-foreground">Topic</span>
                      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                        {params.topicTitle || params.customPrompt}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col gap-5 border-t border-border/30 pt-4">
                    <ParamSlider label="Tone" leftLabel="Professional" rightLabel="Conversational" value={tone} onChange={(v) => handleParamChange({ tone: v })} disabled={isGenerating} />
                    <ParamSlider label="Depth" leftLabel="Brief" rightLabel="Detailed" value={depth} onChange={(v) => handleParamChange({ depth: v })} disabled={isGenerating} />
                    <ParamSlider label="Audience" leftLabel="Expert" rightLabel="Accessible" value={audience} onChange={(v) => handleParamChange({ audience: v })} disabled={isGenerating} />
                  </div>
                </div>
              )}
            </div>

            {isDone && citations.length > 0 && (
              <div className="studio-params-section">
                <button
                  onClick={() => setShowSources((visible) => !visible)}
                  className="flex h-8 w-full items-center justify-between rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="size-3.5" />
                    Sources
                  </span>
                  <span>{showSources ? "Hide" : citations.length}</span>
                </button>
              </div>
            )}

            <div className="studio-params-section" style={{ flex: 1, border: "none" }}>
              <span className="text-xs font-medium text-foreground">Inline edits</span>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Select text to reveal focused AI editing actions.
              </p>
            </div>
          </div>
        )}

        <AnimatePresence>
          {showHistory && (
            <VersionHistoryDrawer
              versions={project.versions ?? []}
              currentMarkdown={markdown}
              onClose={() => setShowHistory(false)}
              onSave={() => onSaveVersion?.("Manual Save", markdown, true)}
              onRevert={(versionId) => onRevertToVersion?.(versionId, markdown)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Publish / Export drawer */}
      {showDrawer && (
        <ArtifactDrawer project={project} markdown={markdown} onClose={() => setShowDrawer(false)} onDone={() => setShowDrawer(false)} />
      )}
    </div>
  );
}
