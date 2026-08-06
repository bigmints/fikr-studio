"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  X,
  Pin,
  RefreshCw,
  Tag,
  Check,
  Pencil,
  ChevronDown,
  Sparkles,
  FileText,
  Link as LinkIcon,
  ExternalLink,
  Trash2,
  Download,
  Clipboard,
  MoreHorizontal,
} from "lucide-react";
import { CONTENT_TYPE_CONFIG, type ContentType } from "@/lib/content-types";
import { analytics } from "@/lib/analytics";
import type { TextBlock } from "@/components/tile-card";
import { MarkdownEntryEditor } from "@/components/markdown-entry-editor";
import {
  exportSingleBlockToMarkdown,
  downloadMarkdown,
  copyToClipboard,
} from "@/lib/export";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function normalizeLead(value: string) {
  return value
    .replace(/^\s{0,3}#{1,6}\s+/, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function withoutDuplicateLeadingTitle(markdown: string, title?: string) {
  if (!title?.trim()) return markdown;
  const lines = markdown.split("\n");
  const firstContentIndex = lines.findIndex((line) => line.trim());
  if (firstContentIndex < 0) return markdown;
  if (normalizeLead(lines[firstContentIndex]) !== normalizeLead(title)) return markdown;

  lines.splice(firstContentIndex, 1);
  while (lines[firstContentIndex]?.trim() === "") lines.splice(firstContentIndex, 1);
  return lines.join("\n");
}

// ── Markdown renderer ─────────────────────────────────────────────────────────
const MD: Record<string, any> = {
  p: ({ children }: any) => (
    <p className="mb-4 last:mb-0 leading-[1.75]">{children}</p>
  ),
  ul: ({ children }: any) => (
    <ul className="mb-4 list-disc space-y-1.5 pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol className="mb-4 list-decimal space-y-1.5 pl-5 last:mb-0">{children}</ol>
  ),
  li: ({ children }: any) => <li className="text-foreground/90">{children}</li>,
  h1: ({ children }: any) => (
    <h1 className="font-display mb-4 mt-10 text-[26px] font-medium leading-8 tracking-[-0.02em] text-foreground first:mt-0 min-[1440px]:text-[30px] min-[1440px]:leading-9">{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="font-display mb-3 mt-9 text-[22px] font-medium leading-[30px] tracking-[-0.015em] text-foreground first:mt-0">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="mb-2 mt-7 text-lg font-semibold leading-[26px] text-foreground first:mt-0">{children}</h3>
  ),
  strong: ({ children }: any) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  a: ({ href, children }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 text-primary hover:underline"
    >
      <LinkIcon className="h-2.5 w-2.5 shrink-0" />
      {children}
    </a>
  ),
  code: ({ children }: any) => (
    <code className="rounded bg-secondary/80 px-1.5 py-0.5 font-mono text-[13px] leading-[21px] text-foreground">
      {children}
    </code>
  ),
  pre: ({ children }: any) => (
    <pre className="mb-4 overflow-x-auto rounded-lg bg-secondary/50 p-4 font-mono text-[13px] leading-[21px] text-foreground">
      {children}
    </pre>
  ),
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface NoteDetailPanelProps {
  block: TextBlock | null;
  isOpen: boolean;
  mode?: "overlay" | "workspace";
  onClose: () => void;
  onEdit: (id: string, newText: string) => void;
  onEditAnnotation: (id: string, newAnnotation: string) => void;
  onReEnrich: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onChangeType?: (id: string, newType: ContentType) => void;
}

export function NoteDetailPanel({
  block,
  isOpen,
  mode = "overlay",
  onClose,
  onEdit,
  onEditAnnotation,
  onReEnrich,
  onDelete,
  onTogglePin,
  onChangeType,
}: NoteDetailPanelProps) {
  // ── Edit state ──────────────────────────────────────────────────────────────
  const [draftText, setDraftText] = useState("");
  const [editingAnnotation, setEditingAnnotation] = useState(false);
  const [draftAnnotation, setDraftAnnotation] = useState("");
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"synthesis" | "original">(
    "original",
  );
  const [expandedEditorOpen, setExpandedEditorOpen] = useState(false);

  const annotationRef = useRef<HTMLTextAreaElement>(null);

  // Reset edit state when the block changes
  useEffect(() => {
    if (block) {
      setDraftText(block.text);
      setDraftAnnotation(block.annotation || "");
      setEditingAnnotation(false);
      setExpandedEditorOpen(false);
      setTypePickerOpen(false);
      // Auto-switch tab: default to original
      setActiveTab("original");
    }
  }, [block?.id, block]);

  useEffect(() => {
    if (editingAnnotation && annotationRef.current) {
      const el = annotationRef.current;
      el.focus();
      el.selectionStart = el.value.length;
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [editingAnnotation]);

  // Close handler with analytics tracking
  const handleClose = useCallback(() => {
    analytics.track("detail_close");
    onClose();
  }, [onClose]);

  // Escape to close panel
  useEffect(() => {
    if (!isOpen || mode === "workspace") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !editingAnnotation) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, mode, editingAnnotation, handleClose]);

  const saveExpandedText = useCallback(() => {
    if (!block || !draftText.trim()) return;
    if (draftText !== block.text) {
      onEdit(block.id, draftText);
      toast("Changes saved");
    }
    setExpandedEditorOpen(false);
  }, [block, draftText, onEdit]);

  const openExpandedEditor = useCallback(() => {
    if (!block) return;
    setDraftText(block.text);
    setExpandedEditorOpen(true);
    analytics.track("markdown_editor_open", { source: "existing_note" });
  }, [block]);

  const saveAnnotation = useCallback(() => {
    if (!block) return;
    onEditAnnotation(block.id, draftAnnotation);
    setEditingAnnotation(false);
  }, [block, draftAnnotation, onEditAnnotation]);

  const handleDelete = useCallback(() => {
    if (!block) return;
    if (confirm("Delete this note permanently?")) {
      analytics.track("detail_delete", { blockId: block.id });
      onDelete(block.id);
      handleClose();
    }
  }, [block, onDelete, handleClose]);

  const handleExportMd = useCallback(() => {
    if (!block) return;
    analytics.track("note_export_md", { blockId: block.id });
    const md = exportSingleBlockToMarkdown(block);
    const slug = block.text
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 30);
    downloadMarkdown(`${slug || "note"}.md`, md);
    toast("Markdown exported");
  }, [block]);

  const handleCopyMd = useCallback(async () => {
    if (!block) return;
    analytics.track("note_copy_md", { blockId: block.id });
    const md = exportSingleBlockToMarkdown(block);
    const copied = await copyToClipboard(md);
    if (copied) toast("Markdown copied");
    else toast.error("Couldn’t copy Markdown");
  }, [block]);

  if (!block) {
    if (mode !== "workspace") return null;
    return (
      <aside className="flex h-full min-w-0 flex-col items-center justify-center border-l border-border/40 bg-background px-8 text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-border/35 bg-secondary/30">
          <FileText className="h-4 w-4 text-muted-foreground/60" />
        </div>
        <p className="text-base font-semibold text-foreground/75">Select a note</p>
        <p className="mt-1 max-w-[280px] text-sm leading-6 text-muted-foreground/70">
          Choose a note from the inbox to read, edit, synthesize, or export it here.
        </p>
      </aside>
    );
  }

  const config =
    CONTENT_TYPE_CONFIG[block.contentType] || CONTENT_TYPE_CONFIG.general;
  const Icon = config.icon;
  const accent = config.accentVar;

  const formattedDate = new Date(block.timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const originalMarkdown = withoutDuplicateLeadingTitle(block.text, block.title);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Panel */}
          <motion.aside
            initial={mode === "workspace" ? false : { x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className={mode === "workspace"
              ? "relative h-full min-w-0 flex flex-col bg-background border-l border-border/45 overflow-hidden"
              : "absolute top-0 right-0 h-full w-[550px] max-w-[90vw] shrink-0 z-40 flex flex-col bg-background/80 backdrop-blur-3xl border-l border-white/10 shadow-2xl overflow-hidden"}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`${mode === "workspace" ? "w-full" : "w-[550px]"} h-full min-w-0 flex flex-col`}>
            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="reader-column flex shrink-0 items-center justify-between pb-2 pt-4">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Type chip */}
                <button
                  onClick={() => setTypePickerOpen((v) => !v)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all hover:opacity-80 shrink-0"
                  style={{
                    color: accent,
                    borderColor: `color-mix(in oklch, ${accent} 40%, transparent)`,
                    backgroundColor: `color-mix(in oklch, ${accent} 8%, transparent)`,
                  }}
                  title="Change type"
                >
                  <Icon className="h-3 w-3" />
                  {config.label}
                  <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                </button>

                {block.category && (
                  <span className="truncate text-xs text-muted-foreground/60">
                    {block.category}
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <div
                  className="mr-1 flex h-8 items-center rounded-md bg-secondary/55 p-0.5"
                  role="group"
                  aria-label="Note version"
                >
                  <button
                    type="button"
                    onClick={() => {
                      analytics.track("detail_tab_switch", { tab: "original" });
                      setActiveTab("original");
                    }}
                    aria-pressed={activeTab === "original"}
                    className={`flex h-7 items-center rounded-[5px] px-2.5 text-[12px] font-medium transition-colors ${
                      activeTab === "original"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Original
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      analytics.track("detail_tab_switch", { tab: "synthesis" });
                      setActiveTab("synthesis");
                    }}
                    aria-pressed={activeTab === "synthesis"}
                    className={`flex h-7 items-center rounded-[5px] px-2.5 text-[12px] font-medium transition-colors ${
                      activeTab === "synthesis"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Synthesized
                  </button>
                </div>

                <button
                  onClick={openExpandedEditor}
                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  title="Edit note"
                  aria-label="Edit note"
                >
                  <Pencil className="size-4" />
                </button>

                {onTogglePin && (
                  <button
                    onClick={() => onTogglePin(block.id)}
                    className={`flex size-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                      block.isPinned
                        ? "text-foreground bg-secondary/80"
                        : "text-muted-foreground/70 hover:text-foreground hover:bg-secondary/60"
                    }`}
                    title={block.isPinned ? "Unpin" : "Pin"}
                    aria-label={block.isPinned ? "Unpin note" : "Pin note"}
                  >
                    <Pin
                      className={`size-4 ${block.isPinned ? "fill-current" : "-rotate-45"}`}
                    />
                  </button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex size-8 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      title="More note actions"
                      aria-label="More note actions"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 border-border/60">
                    <DropdownMenuItem
                      onSelect={() => onReEnrich(block.id)}
                      disabled={block.isEnriching}
                      className="min-h-8 cursor-pointer"
                    >
                      <RefreshCw className={block.isEnriching ? "animate-spin" : ""} />
                      Re-synthesize
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={handleCopyMd} className="min-h-8 cursor-pointer">
                      <Clipboard /> Copy Markdown
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={handleExportMd} className="min-h-8 cursor-pointer">
                      <Download /> Export Markdown
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={handleDelete}
                      className="min-h-8 cursor-pointer text-destructive focus:text-destructive"
                    >
                      <Trash2 /> Delete note
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* The inbox editor is persistent; drawers retain their close action. */}
                {mode === "overlay" && (
                  <button
                    onClick={handleClose}
                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    title="Close (Esc)"
                    aria-label="Close note details"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Type picker dropdown */}
            <AnimatePresence>
              {typePickerOpen && onChangeType && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="mx-4 mt-2 rounded-xl border border-border/60 bg-background/98 shadow-xl overflow-hidden z-10"
                >
                  <p className="px-4 pt-3 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/65">
                    Change type
                  </p>
                  <div className="grid grid-cols-2 gap-1 p-2 pt-0">
                    {(
                      Object.entries(CONTENT_TYPE_CONFIG) as [
                        ContentType,
                        any,
                      ][]
                    )
                      .filter(([t]) => t !== "thesis")
                      .map(([type, cfg]) => {
                        const TypeIcon = cfg.icon;
                        const isActive = block.contentType === type;
                        return (
                          <button
                            key={type}
                            onClick={() => {
                              onChangeType(block.id, type);
                              setTypePickerOpen(false);
                            }}
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-all ${
                              isActive
                                ? "bg-primary/10"
                                : "hover:bg-secondary/60"
                            }`}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: cfg.accentVar }}
                            />
                            <TypeIcon
                              className="h-3 w-3 shrink-0"
                              style={{ color: cfg.accentVar }}
                            />
                            <span
                              style={{
                                color: isActive ? cfg.accentVar : undefined,
                              }}
                            >
                              {cfg.label}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Body ─────────────────────────────────────────────────────── */}
            <div className="custom-scrollbar min-h-0 flex-1 scroll-pt-6 overflow-y-auto">
              <div className="reader-column space-y-5 pb-16 pt-8">
              {/* ── Synthesis tab ─────────────────────────────────────────── */}
              {activeTab === "synthesis" && (
                <div className="space-y-4">
                  {block.title && !block.isEnriching && (
                    <h2 className="font-display mb-7 text-[32px] font-medium leading-[38px] tracking-[-0.025em] text-foreground min-[1440px]:text-[34px] min-[1440px]:leading-[40px]">
                      {block.title}
                    </h2>
                  )}
                  {block.isEnriching ? (
                    <div className="space-y-2.5">
                      <div className="h-3.5 rounded bg-secondary/60 animate-pulse w-4/5" />
                      <div className="h-3.5 rounded bg-secondary/60 animate-pulse w-full" />
                      <div className="h-3.5 rounded bg-secondary/60 animate-pulse w-3/5" />
                      <div className="h-3.5 rounded bg-secondary/40 animate-pulse w-full mt-4" />
                      <div className="h-3.5 rounded bg-secondary/40 animate-pulse w-4/5" />
                    </div>
                  ) : block.isError ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                        <X className="h-5 w-5 text-red-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-red-400">
                          Synthesis failed
                        </p>
                        <p className="mx-auto mt-1 max-w-[280px] text-xs leading-5 text-muted-foreground/60">
                          {block.statusText || "An unexpected error occurred during AI analysis."}
                        </p>
                      </div>
                      <button
                        onClick={() => onReEnrich(block.id)}
                        className="flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-xs font-semibold transition-all hover:bg-secondary/80"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Retry
                      </button>
                    </div>
                  ) : block.annotation != null && block.annotation !== "" ? (
                    <>
                      {/* Annotation display / edit */}
                      <div className="group/annot relative">
                        {editingAnnotation ? (
                          <div className="space-y-2.5">
                            <textarea
                              ref={annotationRef}
                              value={draftAnnotation}
                              onChange={(e) => {
                                setDraftAnnotation(e.target.value);
                                e.target.style.height = "auto";
                                e.target.style.height =
                                  e.target.scrollHeight + "px";
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                  setDraftAnnotation(block.annotation || "");
                                  setEditingAnnotation(false);
                                }
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  saveAnnotation();
                                }
                              }}
                              className="w-full resize-none rounded-xl border border-border/60 bg-secondary/20 px-3 py-2.5 text-sm leading-6 text-foreground shadow-inner outline-none transition-all focus:border-primary/50 focus:bg-background focus:ring-4 focus:ring-primary/10"
                              style={{ minHeight: "6rem" }}
                            />
                            <div className="flex items-center justify-between">
                              <span className="text-xs leading-5 text-muted-foreground/65">
                                Enter to save · Shift+Enter for newline · Esc to
                                cancel
                              </span>
                              <button
                                onClick={saveAnnotation}
                                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all"
                                style={{
                                  backgroundColor: accent,
                                  color: "var(--background)",
                                }}
                              >
                                <Check className="h-3 w-3" /> Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="relative">
                            <div className="markdown-body text-[17px] leading-[30px] text-foreground/90">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={MD}
                              >
                                {block.annotation}
                              </ReactMarkdown>
                            </div>
                            <button
                              onClick={() => {
                                setDraftAnnotation(block.annotation || "");
                                setEditingAnnotation(true);
                              }}
                              className="absolute top-0 right-0 p-1.5 rounded-md opacity-0 group-hover/annot:opacity-100 focus-visible:opacity-100 text-muted-foreground/70 hover:text-foreground hover:bg-secondary/60 transition-all"
                              aria-label="Edit synthesized note"
                              title="Edit synthesis"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Confidence */}
                      {block.confidence != null && (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground/65">
                            Confidence
                          </span>
                          <div className="flex-1 h-1 rounded-full bg-secondary/60 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.round(block.confidence)}%`,
                                backgroundColor: accent,
                              }}
                            />
                          </div>
                          <span className="font-mono text-xs text-muted-foreground/70">
                            {Math.round(block.confidence)}%
                          </span>
                        </div>
                      )}

                      {/* Sources */}
                      {block.sources && block.sources.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="font-mono text-xs text-muted-foreground/65">
                            Sources
                          </span>
                          <div className="space-y-1">
                            {block.sources.map((src, i) => (
                              <a
                                key={i}
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 rounded-md px-3 py-2 bg-secondary/30 hover:bg-secondary/60 transition-colors group/src"
                              >
                                <ExternalLink className="h-3 w-3 text-muted-foreground/65 group-hover/src:text-primary shrink-0 transition-colors" />
                                <span className="truncate text-[13px] text-foreground/70">
                                  {src.title || src.siteName || src.url}
                                </span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                      <div className="w-10 h-10 rounded-full bg-secondary/40 flex items-center justify-center">
                        <Sparkles className="h-5 w-5 text-muted-foreground/60" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground/60">
                          No synthesis yet
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground/65">
                          Hit Re-synthesize to generate AI insights
                        </p>
                      </div>
                      <button
                        onClick={() => onReEnrich(block.id)}
                        disabled={block.isEnriching}
                        className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-40"
                        style={{
                          backgroundColor: accent,
                          color: "var(--background)",
                        }}
                      >
                        <RefreshCw className="h-3 w-3" />
                        Re-synthesize
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Original tab ──────────────────────────────────────────── */}
              {activeTab === "original" && (
                <div
                  className="flex h-full flex-col space-y-4"
                  onDoubleClick={(event) => {
                    const target = event.target as HTMLElement;
                    if (target.closest("a, button, input, textarea, select, [contenteditable='true']")) return;
                    openExpandedEditor();
                  }}
                >
                  {block.title && !block.isEnriching && (
                    <h2 className="font-display mb-7 text-[32px] font-medium leading-[38px] tracking-[-0.025em] text-foreground min-[1440px]:text-[34px] min-[1440px]:leading-[40px]">
                      {block.title}
                    </h2>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="w-full">
                      <div className="markdown-body text-[17px] leading-[30px] text-foreground/90">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={MD}
                        >
                          {originalMarkdown}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            {/* ── Document metadata ─────────────────────────────────────────── */}
            <div className="mt-12 flex flex-wrap items-center gap-2 font-mono text-xs leading-[18px] text-muted-foreground/65">
              <span>{formattedDate}</span>
              {block.isPinned && (
                <>
                  <span className="opacity-30">·</span>
                  <span className="text-foreground/65">Pinned</span>
                </>
              )}
              {block.fromSkill && (
                <>
                  <span className="opacity-30">·</span>
                  <span className="text-foreground/65">✦ Pre-synthesized</span>
                </>
              )}
              {block.fromMcp && (
                <>
                  <span className="opacity-30">·</span>
                  <span>via MCP</span>
                </>
              )}
              {block.influencedBy && block.influencedBy.length > 0 && (
                <>
                  <span className="opacity-30">·</span>
                  <span>
                    {block.influencedBy.length} connection
                    {block.influencedBy.length !== 1 ? "s" : ""}
                  </span>
                </>
              )}
            </div>
              </div>
            </div>
            </div>
          </motion.aside>

          <MarkdownEntryEditor
            open={expandedEditorOpen}
            value={draftText}
            initialValue={block.text}
            contextLabel={block.title || "Edit original entry"}
            saveLabel="Save changes"
            onChange={setDraftText}
            onSave={saveExpandedText}
            onClose={() => {
              setDraftText(block.text);
              setExpandedEditorOpen(false);
            }}
          />
        </>
      )}
    </AnimatePresence>
  );
}
