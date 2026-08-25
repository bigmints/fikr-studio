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
  ideating:   { label: "Ideating",   dot: "bg-muted-foreground/60", badge: "bg-secondary text-muted-foreground" },
  generating: { label: "Generating", dot: "shimmer-body",          badge: "bg-secondary text-foreground" },
  done:       { label: "Done",       dot: "bg-foreground/60",       badge: "bg-secondary text-foreground" },
  published:  { label: "Published",  dot: "bg-background",          badge: "bg-foreground text-background" },
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
    <span className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${meta.badge}`}>
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
        role="button"
        tabIndex={0}
        aria-label={`Open ${proj.name}`}
        className="group flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border border-border/25 bg-background px-4 py-3 transition-colors hover:bg-secondary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen();
          }
        }}
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <span className="block truncate text-sm font-semibold">{proj.name}</span>
        </div>
        <StatusBadge status={proj.status} />
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
          {PLATFORM_LABEL[proj.platform] ?? proj.platform}
        </span>
        {wc && <span className="hidden shrink-0 text-xs text-muted-foreground md:block">{wc}</span>}
        <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(proj.updatedAt)}</span>
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <button
            onClick={onDuplicate}
            title="Duplicate"
            className="rounded-md p-1.5 transition-colors hover:bg-secondary"
          >
            <Copy className="size-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={onArchive}
            title={archived ? "Unarchive" : "Archive"}
            className="rounded-md p-1.5 transition-colors hover:bg-secondary"
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
      whileHover={{ y: archived ? 0 : -1 }}
      whileTap={{ scale: 0.99 }}
      role="button"
      tabIndex={0}
      aria-label={`Open ${proj.name}`}
      className="group relative flex cursor-pointer flex-col rounded-lg border border-border/25 bg-background p-4 transition-colors hover:bg-secondary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-secondary p-1.5">
            <Icon className="size-3.5 text-muted-foreground" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {PLATFORM_LABEL[proj.platform] ?? proj.platform}
          </span>
        </div>
        <StatusBadge status={proj.status} />
      </div>

      {/* Name */}
      <h4 className="font-semibold text-sm leading-snug mb-1 line-clamp-2">{proj.name}</h4>

      {/* Meta */}
      <p className="mb-4 text-xs text-muted-foreground">
        {wc ? `${wc} · ` : ""}{relativeTime(proj.updatedAt)}
      </p>

      {/* Actions */}
      <div
        className="mt-auto flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={onDuplicate}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Copy className="size-3" /> Duplicate
        </button>
        <button
          onClick={onArchive}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Archive className="size-3" /> {archived ? "Unarchive" : "Archive"}
        </button>
      </div>

      {/* Generating pulse overlay */}
      {proj.status === "generating" && (
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <Loader2 className="size-3 animate-spin text-foreground" />
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
  const [view, setView] = useState<"grid" | "list">("list");
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
      name:      "New Article",
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
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.2 }}>Studio</span>
          </div>
        </div>

        {/* CENTER: empty */}
        <div className="studio-toolbar__center" />

        {/* RIGHT: view toggle + new project */}
        <div className="studio-toolbar__right">
          <div className="studio-pill-group">
            <button
              onClick={() => setView("grid")}
              className={`studio-pill-btn !text-xs ${view === "grid" ? "active" : ""}`}
              title="Grid view"
            >
              <LayoutGrid className="size-3" />
              <span>Grid</span>
            </button>
            <button
              onClick={() => setView("list")}
              className={`studio-pill-btn !text-xs ${view === "list" ? "active" : ""}`}
              title="List view"
            >
              <List className="size-3" />
              <span>List</span>
            </button>
          </div>
          <div className="studio-toolbar__divider" />
          <button
            onClick={() => setShowModal(true)}
            className="flex h-7 items-center gap-1.5 rounded-md bg-foreground px-2.5 text-xs font-semibold text-background transition-opacity hover:opacity-85"
          >
            <Plus className="size-3" />
            New Article
          </button>
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col px-8 py-8">
          {/* Articles */}
          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-sm font-semibold text-foreground">Articles</h2>
                  <span className="text-xs text-muted-foreground">{displayed.length}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Draft, refine, and publish articles from your notes.</p>
              </div>
            </div>

            {displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/30 bg-secondary/15 p-14 text-center">
                <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-secondary">
                  <FileText className="size-5 text-muted-foreground" />
                </div>
                <h3 className="mb-1 text-sm font-semibold">No articles yet</h3>
                <p className="mb-4 max-w-xs text-xs leading-5 text-muted-foreground">
                  Create an article to start turning your notes into publishable content.
                </p>
                <button onClick={() => setShowModal(true)} className="rounded-md bg-foreground px-3 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-85">
                  New Article
                </button>
              </div>
            ) : view === "grid" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
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
              <div className="flex flex-col gap-1.5">
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

      {/* New article modal */}
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
              className="flex w-full max-w-md flex-col gap-5 rounded-lg border border-border/50 bg-background p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">New Article</h2>
                <button onClick={() => setShowModal(false)} className="rounded-md p-1.5 transition-colors hover:bg-secondary/50" aria-label="Close new article">
                  <X className="size-4" />
                </button>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                  Content Type
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {GENERATION_MODES.map((mode) => {
                    const Icon = MODE_ICONS[mode.id] ?? FileText;
                    return (
                      <button
                        key={mode.id}
                        onClick={() => setSelectedMode(mode.id)}
                        className={`flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${
                          selectedMode === mode.id
                            ? "border-foreground/30 bg-secondary"
                            : "border-border/40 hover:bg-secondary/50"
                        } cursor-pointer`}
                      >
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium">{mode.label}</span>
                        {selectedMode === mode.id && (
                          <Check className="ml-auto size-4 text-foreground" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                  Target Platform
                </label>
                <div className="flex gap-2">
                  {(["linkedin", "substack"] as Platform[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setSelectedPlatform(p)}
                      className={`flex-1 rounded-lg border py-2.5 text-sm font-medium capitalize transition-colors ${
                        selectedPlatform === p
                          ? "border-foreground/30 bg-secondary text-foreground"
                          : "border-border/40 text-muted-foreground hover:bg-secondary/50"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCreate}
                className="w-full rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-85 active:opacity-75"
              >
                Create Article
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
