"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
} from "lucide-react";
import { CONTENT_TYPE_CONFIG, type ContentType } from "@/lib/content-types";
import { analytics } from "@/lib/analytics";
import type { TextBlock } from "@/components/tile-card";
import {
  exportSingleBlockToMarkdown,
  downloadMarkdown,
  copyToClipboard,
} from "@/lib/export";

// ── Markdown renderer ─────────────────────────────────────────────────────────
const MD: Record<string, any> = {
  p: ({ children }: any) => (
    <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
  ),
  ul: ({ children }: any) => (
    <ul className="mb-3 list-disc pl-4 last:mb-0 space-y-1">{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol className="mb-3 list-decimal pl-4 last:mb-0 space-y-1">{children}</ol>
  ),
  li: ({ children }: any) => <li className="text-foreground/80">{children}</li>,
  h1: ({ children }: any) => (
    <h1 className="mb-2 text-sm font-bold text-foreground">{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="mb-2 text-sm font-bold text-foreground">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="mb-1 text-xs font-bold text-foreground">{children}</h3>
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
    <code className="font-mono text-[12px] bg-secondary/80 text-foreground px-1 py-0.5 rounded">
      {children}
    </code>
  ),
  pre: ({ children }: any) => (
    <pre className="bg-secondary/50 p-3 rounded-md overflow-x-auto text-[12px] font-mono text-foreground mb-3">
      {children}
    </pre>
  ),
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface NoteDetailPanelProps {
  block: TextBlock | null;
  isOpen: boolean;
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
  onClose,
  onEdit,
  onEditAnnotation,
  onReEnrich,
  onDelete,
  onTogglePin,
  onChangeType,
}: NoteDetailPanelProps) {
  // ── Edit state ──────────────────────────────────────────────────────────────
  const [editingText, setEditingText] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [editingAnnotation, setEditingAnnotation] = useState(false);
  const [draftAnnotation, setDraftAnnotation] = useState("");
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"synthesis" | "original">(
    "original",
  );

  const textRef = useRef<HTMLTextAreaElement>(null);
  const annotationRef = useRef<HTMLTextAreaElement>(null);

  // Reset edit state when the block changes
  useEffect(() => {
    if (block) {
      setDraftText(block.text);
      setDraftAnnotation(block.annotation || "");
      setEditingText(false);
      setEditingAnnotation(false);
      setTypePickerOpen(false);
      // Auto-switch tab: default to original
      setActiveTab("original");
    }
  }, [block?.id]);

  // Auto-grow textareas
  useEffect(() => {
    if (editingText && textRef.current) {
      const el = textRef.current;
      el.focus();
      el.selectionStart = el.value.length;
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [editingText]);

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
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !editingText && !editingAnnotation) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, editingText, editingAnnotation, handleClose]);

  const saveText = useCallback(() => {
    if (!block) return;
    if (draftText.trim() && draftText !== block.text) {
      onEdit(block.id, draftText.trim());
    }
    setEditingText(false);
  }, [block, draftText, onEdit]);

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
  }, [block]);

  const handleCopyMd = useCallback(() => {
    if (!block) return;
    analytics.track("note_copy_md", { blockId: block.id });
    const md = exportSingleBlockToMarkdown(block);
    copyToClipboard(md);
    // Could add a toast here, but user gets visual feedback anyway
  }, [block]);

  if (!block) return null;

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

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Panel */}
          <motion.aside
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="absolute top-0 right-0 h-full w-[550px] max-w-[90vw] shrink-0 z-40 flex flex-col bg-background/80 backdrop-blur-3xl border-l border-white/10 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-[550px] h-full flex flex-col">
            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/40 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Type chip */}
                <button
                  onClick={() => setTypePickerOpen((v) => !v)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all hover:opacity-80 shrink-0"
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
                  <span className="text-[11px] text-muted-foreground/60 truncate">
                    {block.category}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {/* Pin */}
                {onTogglePin && (
                  <button
                    onClick={() => onTogglePin(block.id)}
                    className={`p-1.5 rounded-md transition-all ${
                      block.isPinned
                        ? "text-foreground bg-secondary/80"
                        : "text-muted-foreground/40 hover:text-foreground hover:bg-secondary/60"
                    }`}
                    title={block.isPinned ? "Unpin" : "Pin"}
                  >
                    <Pin
                      className={`h-3.5 w-3.5 ${block.isPinned ? "fill-current" : "-rotate-45"}`}
                    />
                  </button>
                )}

                {/* Re-enrich */}
                <button
                  onClick={() => onReEnrich(block.id)}
                  disabled={block.isEnriching}
                  className="p-1.5 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-secondary/60 transition-all disabled:opacity-30"
                  title="Re-synthesize"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${block.isEnriching ? "animate-spin" : ""}`}
                  />
                </button>

                {/* Copy as Markdown */}
                <button
                  onClick={handleCopyMd}
                  className="p-1.5 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-secondary/60 transition-all"
                  title="Copy as Markdown"
                >
                  <Clipboard className="h-3.5 w-3.5" />
                </button>

                {/* Export as Markdown */}
                <button
                  onClick={handleExportMd}
                  className="p-1.5 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-secondary/60 transition-all"
                  title="Export as Markdown"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>

                {/* Delete */}
                <button
                  onClick={handleDelete}
                  className="p-1.5 rounded-md text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Delete note"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>

                {/* Close */}
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-secondary/60 transition-all"
                  title="Close (Esc)"
                >
                  <X className="h-4 w-4" />
                </button>
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
                  <p className="px-4 pt-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
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
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] transition-all ${
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

            {/* ── Tab switcher ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-0 px-5 pt-3 shrink-0 relative z-10">
              <button
                onClick={() => {
                  analytics.track("detail_tab_switch", { tab: "original" });
                  setActiveTab("original");
                }}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-t-md text-[11px] font-semibold transition-all ${
                  activeTab === "original"
                    ? "text-primary"
                    : "text-muted-foreground/50 hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                <FileText className="h-3 w-3" />
                Original
                {activeTab === "original" && (
                  <motion.div
                    layoutId="activeTabUnderline"
                    className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-primary"
                  />
                )}
              </button>
              <button
                onClick={() => {
                  analytics.track("detail_tab_switch", { tab: "synthesis" });
                  setActiveTab("synthesis");
                }}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-t-md text-[11px] font-semibold transition-all ${
                  activeTab === "synthesis"
                    ? "text-primary"
                    : "text-muted-foreground/50 hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                <Sparkles className="h-3 w-3" />
                Synthesized
                {activeTab === "synthesis" && (
                  <motion.div
                    layoutId="activeTabUnderline"
                    className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-primary"
                  />
                )}
              </button>
            </div>
            <div className="h-px bg-border/40 mx-0 shrink-0 relative z-0" />

            {/* ── Body ─────────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-5">
              {/* ── Synthesis tab ─────────────────────────────────────────── */}
              {activeTab === "synthesis" && (
                <div className="space-y-4">
                  {block.title && !block.isEnriching && (
                    <h2 className="text-[18px] font-bold leading-tight tracking-tight text-foreground mb-4">
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
                        <p className="text-[13px] text-red-400 font-semibold">
                          Synthesis failed
                        </p>
                        <p className="text-[11px] text-muted-foreground/60 mt-0.5 max-w-[240px] mx-auto">
                          {block.statusText || "An unexpected error occurred during AI analysis."}
                        </p>
                      </div>
                      <button
                        onClick={() => onReEnrich(block.id)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-semibold bg-secondary hover:bg-secondary/80 transition-all"
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
                              className="w-full resize-none rounded-xl bg-secondary/20 border border-border/60 px-3 py-2.5 text-[13px] leading-relaxed text-foreground focus:bg-background focus:border-primary/50 focus:ring-4 focus:ring-primary/10 shadow-inner outline-none transition-all"
                              style={{ minHeight: "6rem" }}
                            />
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground/40">
                                Enter to save · Shift+Enter for newline · Esc to
                                cancel
                              </span>
                              <button
                                onClick={saveAnnotation}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold transition-all"
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
                            <div className="max-w-none text-[13px] leading-relaxed text-foreground/90 markdown-body">
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
                              className="absolute top-0 right-0 p-1.5 rounded-md opacity-0 group-hover/annot:opacity-100 text-muted-foreground/50 hover:text-foreground hover:bg-secondary/60 transition-all"
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
                          <span className="text-[10px] text-muted-foreground/40 font-mono uppercase tracking-widest">
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
                          <span className="text-[10px] font-mono text-muted-foreground/50">
                            {Math.round(block.confidence)}%
                          </span>
                        </div>
                      )}

                      {/* Sources */}
                      {block.sources && block.sources.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] text-muted-foreground/40 font-mono uppercase tracking-widest">
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
                                <ExternalLink className="h-3 w-3 text-muted-foreground/40 group-hover/src:text-primary shrink-0 transition-colors" />
                                <span className="text-[12px] text-foreground/70 truncate">
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
                        <Sparkles className="h-5 w-5 text-muted-foreground/30" />
                      </div>
                      <div>
                        <p className="text-[13px] text-muted-foreground/60">
                          No synthesis yet
                        </p>
                        <p className="text-[11px] text-muted-foreground/40 mt-0.5">
                          Hit Re-synthesize to generate AI insights
                        </p>
                      </div>
                      <button
                        onClick={() => onReEnrich(block.id)}
                        disabled={block.isEnriching}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all disabled:opacity-40"
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
                <div className="flex flex-col h-full space-y-4">
                  {block.title && !block.isEnriching && (
                    <h2 className="text-[18px] font-bold leading-tight tracking-tight text-foreground mb-4">
                      {block.title}
                    </h2>
                  )}
                  <div className="flex items-center justify-between">
                    {editingText ? (
                      <div className="space-y-2.5">
                        <textarea
                          ref={textRef}
                          value={draftText}
                          onChange={(e) => {
                            setDraftText(e.target.value);
                            e.target.style.height = "auto";
                            e.target.style.height =
                              e.target.scrollHeight + "px";
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setDraftText(block.text);
                              setEditingText(false);
                            }
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              saveText();
                            }
                          }}
                          className="w-full resize-none rounded-xl bg-secondary/20 border border-border/60 px-3 py-2.5 text-[13px] leading-relaxed text-foreground focus:bg-background focus:border-primary/50 focus:ring-4 focus:ring-primary/10 shadow-inner outline-none transition-all"
                          style={{ minHeight: "6rem" }}
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground/40">
                            Enter to save · Shift+Enter for newline · Esc to
                            cancel
                          </span>
                          <button
                            onClick={saveText}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold transition-all"
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
                        <div className="max-w-none text-[13px] leading-relaxed text-foreground/90 markdown-body">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={MD}
                          >
                            {block.text}
                          </ReactMarkdown>
                        </div>
                        <button
                          onClick={() => {
                            setDraftText(block.text);
                            setEditingText(true);
                          }}
                          className="absolute top-0 right-0 p-1.5 rounded-md opacity-0 group-hover/text:opacity-100 text-muted-foreground/50 hover:text-foreground hover:bg-secondary/60 transition-all"
                          title="Edit original text"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Footer metadata ───────────────────────────────────────────── */}
            <div className="shrink-0 border-t border-border/40 px-5 py-3 flex items-center gap-3 text-[10px] text-muted-foreground/40 font-mono">
              <span>{formattedDate}</span>
              {block.isPinned && (
                <>
                  <span className="opacity-30">·</span>
                  <span className="text-primary/60">Pinned</span>
                </>
              )}
              {block.fromSkill && (
                <>
                  <span className="opacity-30">·</span>
                  <span className="text-primary/60">✦ Pre-synthesized</span>
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
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
