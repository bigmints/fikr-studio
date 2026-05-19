"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Lightbulb } from "lucide-react";
import type { TextBlock } from "@/components/tile-card";
import type { StudioProject, ScoredTopic, GenerateParams } from "@/lib/generate/types";
import { scoreTopics } from "@/lib/generate/topic-scorer";
import { sampleContext } from "@/lib/generate/context-sampler";

interface Props {
  project: StudioProject;
  intelBlocks: TextBlock[];
  onBack: () => void;
  onGenerate: (params: GenerateParams) => void;
}

function Slider({
  label, leftLabel, rightLabel, value, onChange,
}: {
  label: string; leftLabel: string; rightLabel: string;
  value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="text-xs font-mono text-primary tabular-nums">{value}</span>
      </div>
      <div className="flex flex-col gap-2">
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="studio-slider w-full"
          style={{
            background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${value}%, var(--border) ${value}%, var(--border) 100%)`,
          }}
        />
        <div className="flex justify-between items-center px-0.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold opacity-80">{leftLabel}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold opacity-80">{rightLabel}</span>
        </div>
      </div>
    </div>
  );
}


export function StudioIdeation({ project, intelBlocks, onBack, onGenerate }: Props) {
  const [topics, setTopics] = useState<ScoredTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<ScoredTopic | null>(null);
  const [customPrompt, setCustomPrompt] = useState(project.customPrompt ?? "");
  const [tone,     setTone]     = useState(project.tone     ?? 50);
  const [depth,    setDepth]    = useState(project.depth    ?? 50);
  const [audience, setAudience] = useState(project.audience ?? 50);

  useEffect(() => {
    const computed = scoreTopics(intelBlocks);
    setTopics(computed);
    if (computed.length > 0 && !selectedTopic) setSelectedTopic(computed[0]);
  }, [intelBlocks]);

  const canGenerate = selectedTopic !== null || customPrompt.trim().length > 0;

  const handleGenerate = () => {
    const { contextString } = sampleContext(intelBlocks);
    const params: GenerateParams = {
      mode:         project.mode,
      platform:     project.platform,
      tone, depth, audience,
      topicTitle:   selectedTopic?.title ?? customPrompt.trim(),
      customPrompt: customPrompt.trim(),
      noteContext:  contextString,
    };
    onGenerate(params);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Toolbar ── 3-zone per layout.md ───────────────────────────── */}
      <header className="studio-toolbar">
        {/* LEFT: back + divider + project name */}
        <div className="studio-toolbar__left">
          <button onClick={onBack} className="studio-icon-btn" title="Back">
            <ArrowLeft className="size-4" />
          </button>
          <div className="studio-toolbar__divider" />
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.2 }}>{project.name}</span>
          </div>
        </div>

        {/* CENTER: empty */}
        <div className="studio-toolbar__center" />

        {/* RIGHT: generate CTA */}
        <div className="studio-toolbar__right">
          <button
            onClick={handleGenerate}
            disabled={!canGenerate || project.status === "generating"}
            className="studio-pill-btn primary"
          >
            <Sparkles className="size-3" /> Generate
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-8">
          {/* Topic Suggestions */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="size-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                Ideas based on your notes
                {topics.length === 0 && <span className="text-muted-foreground font-normal ml-2">(add Intel notes to get suggestions)</span>}
              </h2>
            </div>
            {topics.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {topics.map((topic, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => { setSelectedTopic(topic); setCustomPrompt(""); }}
                    className={`relative text-left p-4 rounded-xl border transition-all ${
                      selectedTopic?.title === topic.title
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border/50 hover:border-primary/40 bg-card"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <p className="text-sm font-medium leading-snug text-foreground line-clamp-2">{topic.title}</p>
                      <span className="text-[10px] font-bold text-primary shrink-0">{topic.score}%</span>
                    </div>
                    {/* Richness bar */}
                    <div className="w-full h-1 rounded-full bg-border/40 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${topic.score}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2">{topic.previewText}</p>
                  </motion.button>
                ))}
              </div>
            )}
          </section>

          {/* Custom Prompt */}
          <section>
            <label className="block text-sm font-semibold mb-2 text-foreground">
              Or write your own topic / keywords / prompt
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => { setCustomPrompt(e.target.value); if (e.target.value) setSelectedTopic(null); }}
              placeholder="Type a topic, keywords, or a full prompt..."
              rows={4}
              className="w-full rounded-xl border border-border/50 bg-card px-4 py-3 text-sm resize-none focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/40"
            />
          </section>

          {/* Parameter Sliders */}
          <section className="bg-card border border-border/30 rounded-2xl p-6 flex flex-col gap-6">
            <h2 className="text-sm font-semibold text-foreground">Generation Parameters</h2>
            <Slider label="Tone" leftLabel="Professional" rightLabel="Fun" value={tone} onChange={setTone} />
            <Slider label="Depth" leftLabel="Brief" rightLabel="Detailed" value={depth} onChange={setDepth} />
            <Slider label="Audience" leftLabel="Expert" rightLabel="Beginner" value={audience} onChange={setAudience} />
          </section>
        </div>
      </div>
    </div>
  );
}
