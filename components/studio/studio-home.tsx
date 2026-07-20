"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid, List, FileText,
  Plus, X, Check, Archive, Copy, Loader2,
} from "lucide-react";
import type { StudioProject, ContentMode, Platform } from "@/lib/generate/types";
import { GENERATION_MODES } from "@/lib/generate/generation-modes";

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

const MODE_ICONS: Record<string, React.ElementType> = {
  article:       FileText,
};

const PLATFORM_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  substack: "Substack",
};

type StatusMeta = { label: string; dot: string; badge: string };

const STATUS_META: Record<string, StatusMeta> = {
  ideating:   { label: "Ideating",   dot: "bg-zinc-400",          badge: "bg-zinc-400/15 text-zinc-400" },
  generating: { label: "Generating", dot: "shimmer-body", badge: "bg-primary/15 text-primary" },
  done:       { label: "Done",       dot: "bg-[#22C55E]",        badge: "bg-[#22C55E]/15 text-[#22C55E]" },
  published:  { label: "Published",  dot: "bg-blue-400",           badge: "bg-blue-400/15 text-blue-400" },
  error:      { label: "Failed",     dot: "bg-red-400",            badge: "bg-red-400/15 text-red-400" },
};

function wordCount(proj: StudioProject) {
  if (!proj.outputMarkdown) return null;
  const n = proj.outputMarkdown.trim().split(/\s+/).filter(Boolean).length;
  return n > 0 ? `${n.toLocaleString()} words` : null;
}

function relativeTime(ts: number) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface StatusBadgeProps { status: string; }
function StatusBadge({ status }: StatusBadgeProps) {
  const meta = STATUS_META[status] ?? STATUS_META.ideating;
  return (
    <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${meta.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

interface CardProps {
  proj: StudioProject;
  onOpen: () => void;
  onArchive: () => void;
  onDuplicate: () => void;
  view: "grid" | "list";
}

function ProjectCard({ proj, onOpen, onArchive, onDuplicate, view }: CardProps) {
  const Icon = MODE_ICONS[proj.mode] ?? FileText;
  const wc = wordCount(proj);
  const archived = proj.archived;

  if (view === "list") {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: archived ? 0.45 : 1, y: 0 }}
        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/30 bg-card hover:border-primary/30 transition-colors cursor-pointer group"
        onClick={onOpen}
      >
        <Icon className="size-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium truncate block">{proj.name}</span>
        </div>
        <StatusBadge status={proj.status} />
        <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:block">
          {PLATFORM_LABEL[proj.platform] ?? proj.platform}
        </span>
        {wc && <span className="text-[11px] text-muted-foreground shrink-0 hidden md:block">{wc}</span>}
        <span className="text-[11px] text-muted-foreground shrink-0">{relativeTime(proj.updatedAt)}</span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onDuplicate}
            title="Duplicate"
            className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors"
          >
            <Copy className="size-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={onArchive}
            title={archived ? "Unarchive" : "Archive"}
            className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors"
          >
            <Archive className="size-3.5 text-muted-foreground" />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: archived ? 0.45 : 1, scale: 1 }}
      whileHover={{ scale: archived ? 1 : 1.015 }}
      whileTap={{ scale: 0.98 }}
      className="group relative flex flex-col p-4 rounded-2xl border border-border/30 bg-card hover:border-primary/40 transition-colors cursor-pointer"
      onClick={onOpen}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Icon className="size-3.5 text-primary" />
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {PLATFORM_LABEL[proj.platform] ?? proj.platform}
          </span>
        </div>
        <StatusBadge status={proj.status} />
      </div>

      {/* Name */}
      <h4 className="font-semibold text-sm leading-snug mb-1 line-clamp-2">{proj.name}</h4>

      {/* Meta */}
      <p className="text-[11px] text-muted-foreground mb-4">
        {wc ? `${wc} · ` : ""}{relativeTime(proj.updatedAt)}
      </p>

      {/* Actions */}
      <div
        className="mt-auto flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onDuplicate}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-secondary/60 transition-colors"
        >
          <Copy className="size-3" /> Duplicate
        </button>
        <button
          onClick={onArchive}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-secondary/60 transition-colors"
        >
          <Archive className="size-3" /> {archived ? "Unarchive" : "Archive"}
        </button>
      </div>

      {/* Generating pulse overlay */}
      {proj.status === "generating" && (
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <Loader2 className="size-3 text-primary animate-spin" />
        </div>
      )}
    </motion.div>
  );
}

interface Props {
  projects: StudioProject[];
  onOpenProject:  (id: string) => void;
  onNewProject:   (project: StudioProject) => void;
  onArchive:      (id: string) => void;
  onUnarchive:    (id: string) => void;
  onDuplicate:    (id: string) => void;
}

export function StudioHome({
  projects, onOpenProject, onNewProject, onArchive, onUnarchive, onDuplicate,
}: Props) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showModal, setShowModal] = useState(false);
  const [selectedMode, setSelectedMode] = useState<ContentMode>("article");
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>("linkedin");
  const [showArchived, setShowArchived] = useState(false);

  const active   = projects.filter((p) => !p.archived);
  const archived = projects.filter((p) => p.archived);

  const handleCreate = () => {
    const mode = GENERATION_MODES.find((m) => m.id === selectedMode);
    if (!mode) return;
    const project: StudioProject = {
      id:        generateId(),
      name:      `New ${mode.label}`,
      mode:      selectedMode,
      platform:  selectedPlatform,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status:    "ideating",
      tone:      50,
      depth:     50,
      audience:  50,
    };
    onNewProject(project);
    setShowModal(false);
  };

  const displayed = showArchived ? [...active, ...archived] : active;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background">

      {/* ── Toolbar ── per layout.md ───────────────────────────────────── */}
      <header className="studio-toolbar">
        {/* LEFT: page title */}
        <div className="studio-toolbar__left">
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.2 }}>Studio</span>
          </div>
        </div>

        {/* CENTER: empty */}
        <div className="studio-toolbar__center" />

        {/* RIGHT: view toggle + new project */}
        <div className="studio-toolbar__right">
          <div className="studio-pill-group">
            <button
              onClick={() => setView("grid")}
              className={`studio-pill-btn ${view === "grid" ? "active" : ""}`}
              title="Grid view"
            >
              <LayoutGrid className="size-3" />
              <span>Grid</span>
            </button>
            <button
              onClick={() => setView("list")}
              className={`studio-pill-btn ${view === "list" ? "active" : ""}`}
              title="List view"
            >
              <List className="size-3" />
              <span>List</span>
            </button>
          </div>
          <div className="studio-toolbar__divider" />
          <button
            onClick={() => setShowModal(true)}
            className="studio-pill-btn primary"
          >
            <Plus className="size-3" />
            New Project
          </button>
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto w-full px-8 py-8 flex flex-col gap-8">

          {/* Quick-start content type */}
          <div className="grid grid-cols-1 max-w-sm gap-3">
          {GENERATION_MODES.map((mode) => {
            const Icon = MODE_ICONS[mode.id] ?? FileText;
            return (
              <button
                key={mode.id}
                onClick={() => {
                  setSelectedMode(mode.id);
                  setShowModal(true);
                }}
                className="group relative flex items-center gap-3 p-4 rounded-xl border border-border/40 bg-card hover:border-primary/50 text-left transition-all overflow-hidden cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Icon className="size-4" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{mode.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Long-form for LinkedIn or Substack
                  </p>
                </div>
              </button>
            );
          })}
          </div>

          {/* Projects */}
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Projects
            </h2>

            {displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-14 text-center border border-border/30 border-dashed rounded-2xl bg-card/20">
                <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                  <FileText className="size-6 text-primary/60" />
                </div>
                <h3 className="font-semibold mb-1">No projects yet</h3>
                <p className="text-sm text-muted-foreground max-w-xs mb-4">
                  Pick a content type above or click New Project to start turning your notes into content.
                </p>
              </div>
            ) : view === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {displayed.map((proj) => (
                <ProjectCard
                  key={proj.id}
                  proj={proj}
                  view="grid"
                  onOpen={() => onOpenProject(proj.id)}
                  onArchive={() => proj.archived ? onUnarchive(proj.id) : onArchive(proj.id)}
                  onDuplicate={() => onDuplicate(proj.id)}
                />
              ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {displayed.map((proj) => (
                  <ProjectCard
                    key={proj.id}
                    proj={proj}
                    view="list"
                    onOpen={() => onOpenProject(proj.id)}
                    onArchive={() => proj.archived ? onUnarchive(proj.id) : onArchive(proj.id)}
                    onDuplicate={() => onDuplicate(proj.id)}
                  />
                ))}
              </div>
            )}

            {archived.length > 0 && (
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showArchived ? "Hide archived" : `Show archived (${archived.length})`}
              </button>
            )}
          </section>
        </div>
      </div>

      {/* New Project Modal — kept as-is per plan */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background border border-border/50 rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg">New Project</h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-full hover:bg-secondary/50 transition-colors">
                  <X className="size-4" />
                </button>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">
                  Content Type
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {GENERATION_MODES.map((mode) => {
                    const Icon = MODE_ICONS[mode.id] ?? FileText;
                    return (
                      <button
                        key={mode.id}
                        onClick={() => setSelectedMode(mode.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                          selectedMode === mode.id
                            ? "border-primary bg-primary/10"
                            : "border-border/40 hover:border-primary/30"
                        } cursor-pointer`}
                      >
                        <Icon className="size-5 text-primary shrink-0" />
                        <span className="font-medium text-sm">{mode.label}</span>
                        {selectedMode === mode.id && (
                          <Check className="size-4 text-primary ml-auto" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">
                  Target Platform
                </label>
                <div className="flex gap-2">
                  {(["linkedin", "substack"] as Platform[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setSelectedPlatform(p)}
                      className={`flex-1 py-2.5 rounded-xl border text-sm font-medium capitalize transition-all ${
                        selectedPlatform === p
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/40 hover:border-primary/30 text-muted-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCreate}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all active:scale-95"
              >
                Create Project
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
