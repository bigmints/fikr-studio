"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft, RefreshCw, Eye, EyeOff, Sparkles, BookOpen,
  MoreHorizontal, Wand2,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type {
  StudioProject, GenerateParams, Citation,
} from "@/lib/generate/types";
import { StudioRichEditor } from "./studio-rich-editor";
import { ArtifactDrawer } from "./artifact-drawer";
import { LOCAL_AI_CONFIG, LM_STUDIO_MODELS } from "@/local-ai.config";
import PRESETS from "@/lib/generate/presets.json";

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
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex justify-between items-baseline">
        <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">{label}</span>
        <span className="text-[10px] font-mono text-muted-foreground font-semibold">{value}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <input
          type="range" min={0} max={100} value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="studio-slider w-full"
          style={{
            opacity: disabled ? 0.5 : 1,
            background: `linear-gradient(to right, #3CA6A6 0%, #3CA6A6 ${value}%, rgba(16,43,36,0.12) ${value}%, rgba(16,43,36,0.12) 100%)`,
          }}
        />
        <div className="flex justify-between items-center px-0.5">
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold opacity-70">{leftLabel}</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold opacity-70">{rightLabel}</span>
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
}: Props) {
  const rawMarkdown = project.outputMarkdown ?? "";
  const [markdown, setMarkdown] = useState(() => cleanMarkdown(rawMarkdown));
  const [citations] = useState<Citation[]>(project.citations ?? []);
  const [showSources, setShowSources] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [tone,     setTone]     = useState(params.tone     ?? 50);
  const [depth,    setDepth]    = useState(params.depth    ?? 50);
  const [audience, setAudience] = useState(params.audience ?? 50);

  const [presetId, setPresetId] = useState<string>(params.presetId ?? PRESETS[0].id);
  const [maxLength, setMaxLength] = useState<number>(params.maxLength ?? PRESETS[0].maxLength);
  const [enableHashtags, setEnableHashtags] = useState<boolean>(params.enableHashtags ?? PRESETS[0].enableHashtags);

  const activePreset = PRESETS.find(p => p.id === presetId) || PRESETS[0];

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

  // Dev Model Switcher state
  const [devModel, setDevModel] = useState<string>(LOCAL_AI_CONFIG.model);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dev_local_model");
      if (stored) setDevModel(stored);
    }
  }, []);

  const handleModelChange = (newModel: string) => {
    setDevModel(newModel);
    localStorage.setItem("dev_local_model", newModel);
  };

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

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showMenu]);

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
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.2 }}>{project.name}</span>
          </div>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* GENERATING */}
          {isGenerating && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 48 }}>
              <div className="flex items-center justify-center w-12 h-12 rounded-full border border-border/50 shadow-sm shimmer-body mb-2">
                <Sparkles className="size-5 text-primary" />
              </div>
              <p className="text-sm font-semibold shimmer-text" style={{ transition: "opacity 0.4s", opacity: msgVisible ? 1 : 0, minHeight: 24, textAlign: "center" }}>
                {MSGS[msgIdx]}
              </p>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", maxWidth: 320, textAlign: "center", lineHeight: 1.6 }}>
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
                <span style={{ color: "#ef4444", fontWeight: 700, fontSize: 18 }}>!</span>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600 }}>Generation failed</p>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", maxWidth: 340, lineHeight: 1.6 }}>
                {project.error || "The AI model produced no output. Try adjusting your parameters."}
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button onClick={() => onRegenerate(currentParams)} className="studio-btn-primary">Retry</button>
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
                    <p className="studio-params-label" style={{ marginBottom: 12 }}>Sources from your notes</p>
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
                          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--primary)", minWidth: 20 }}>[{c.index}]</span>
                          <p style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.5, margin: 0 }}>{c.notePreview}</p>
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

            {/* Platform + Topic */}
            <div className="studio-params-section">
              <span className="studio-params-label">Preset</span>
              <select 
                value={presetId}
                onChange={(e) => handlePresetChange(e.target.value)}
                disabled={isGenerating}
                className="mt-2 w-full bg-background border border-border rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {PRESETS.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              <span className="studio-params-label mt-5">Content Rules</span>
              <div className="flex flex-col gap-3 mt-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Max Words</span>
                  <div className="flex items-center gap-1">
                    <input 
                      type="number" 
                      value={maxLength} 
                      onChange={e => {
                         const v = parseInt(e.target.value) || 0;
                         setMaxLength(v);
                         handleParamChange({ maxLength: v });
                      }}
                      className="w-16 bg-background border border-border rounded text-center text-foreground py-0.5"
                      disabled={isGenerating}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={enableHashtags}
                    onChange={e => {
                       setEnableHashtags(e.target.checked);
                       handleParamChange({ enableHashtags: e.target.checked });
                    }}
                    disabled={isGenerating}
                    className="accent-primary"
                  />
                  Enable Hashtags
                </label>
              </div>

              {(params.topicTitle || params.customPrompt) && (
                <>
                  <span className="studio-params-label mt-5">Topic</span>
                  <p className="text-[12px] leading-relaxed m-0 mt-1.5 text-muted-foreground/80">
                    {params.topicTitle || params.customPrompt}
                  </p>
                </>
              )}
            </div>

            {/* Sliders */}
            <div className="studio-params-section">
              <span className="studio-params-label">Parameters</span>
              <div className="flex flex-col gap-5 mt-3">
                <ParamSlider label="Tone" leftLabel="Professional" rightLabel="Fun" value={tone} onChange={(v) => handleParamChange({ tone: v })} disabled={isGenerating} />
                <ParamSlider label="Depth" leftLabel="Brief" rightLabel="Detailed" value={depth} onChange={(v) => handleParamChange({ depth: v })} disabled={isGenerating} />
                <ParamSlider label="Audience" leftLabel="Expert" rightLabel="Beginner" value={audience} onChange={(v) => handleParamChange({ audience: v })} disabled={isGenerating} />
              </div>
              <button
                onClick={() => onRegenerate(currentParams)}
                disabled={isGenerating}
                className="flex items-center justify-center gap-2 w-full mt-6 h-10 rounded-full text-[11px] font-semibold tracking-wide transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                style={{ background: "#3CA6A6", color: "#fff", boxShadow: "0 2px 8px rgba(60,166,166,0.25)" }}
              >
                <RefreshCw className={`size-3.5 ${isGenerating ? "animate-spin" : ""}`} />
                {isGenerating ? "Generating…" : "Regenerate"}
              </button>
              
              {/* Publish Button */}
              {isDone && (
                <div className="flex flex-col mt-3">
                  <button
                    onClick={() => setShowDrawer(true)}
                    disabled={wordCount > maxLength}
                    className="flex items-center justify-center gap-2 w-full h-10 rounded-full text-[11px] font-semibold tracking-wide transition-all hover:bg-primary/10 active:scale-[0.98] border border-primary/20 disabled:opacity-50 disabled:pointer-events-none"
                    style={{ color: "#3CA6A6" }}
                  >
                    <BookOpen className="size-3.5" />
                    Publish Article
                  </button>
                  <div className="flex justify-between items-center mt-2 px-1">
                    <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-bold">Word Count</span>
                    <span className={`text-[10px] font-mono font-bold ${wordCount > maxLength ? "text-red-500" : "text-muted-foreground"}`}>
                      {wordCount} / {maxLength}
                    </span>
                  </div>
                  {wordCount > maxLength && (
                    <p className="text-[10px] text-red-500 mt-1 text-center font-medium">Word limit exceeded! Reduce length to publish.</p>
                  )}
                </div>
              )}

              {/* Sources Toggle */}
              {isDone && citations.length > 0 && (
                <button
                  onClick={() => setShowSources((v) => !v)}
                  className={`flex items-center justify-between w-full mt-4 px-4 h-9 rounded-lg text-[10px] font-semibold tracking-wide transition-all border ${showSources ? "bg-secondary border-border/50 text-foreground" : "bg-transparent border-border/30 text-muted-foreground hover:text-foreground hover:bg-secondary/30"}`}
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="size-3" />
                    Sources
                  </span>
                  <span className="opacity-50">{showSources ? "Hide" : "Show"}</span>
                </button>
              )}
            </div>

            {/* Annotation guide */}
            <div className="studio-params-section" style={{ flex: 1, border: "none" }}>
              <span className="studio-params-label">Inline AI Edits</span>
              <p className="text-[12px] leading-relaxed m-0 mt-2 text-muted-foreground/70">
                Select any text to reveal the editing menu. The AI rewrites only your selection.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Publish / Export drawer */}
      {showDrawer && (
        <ArtifactDrawer project={project} markdown={markdown} onClose={() => setShowDrawer(false)} onDone={() => setShowDrawer(false)} />
      )}
    </div>
  );
}
