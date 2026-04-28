"use client";

import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Check,
  Pin,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Link as LinkIcon,
  Sparkles,
  Tag,
  Quote,
} from "lucide-react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CONTENT_TYPE_CONFIG, type ContentType } from "@/lib/content-types";

export interface TextBlock {
  id: string;
  text: string;
  timestamp: number;
  contentType: ContentType;
  category?: string;
  isEnriching?: boolean;
  statusText?: string;
  isError?: boolean;
  annotation?: string;
  confidence?: number | null;
  sources?: { url: string; title: string; siteName: string }[];
  influencedBy?: string[];
  isUnrelated?: boolean;
  isPinned?: boolean;
  subTasks?: { id: string; text: string; isDone: boolean; timestamp: number }[];
}

interface TileCardProps {
  block: TextBlock;
  isCollapsed: boolean;
  hideCollapse?: boolean;
  onDelete: (id: string) => void;
  onEdit: (id: string, newText: string) => void;
  onEditAnnotation: (id: string, newAnnotation: string) => void;
  onReEnrich: (id: string, newCategory?: string) => void;
  onToggleCollapse: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onToggleSubTask?: (blockId: string, subTaskId: string) => void;
  onDeleteSubTask?: (blockId: string, subTaskId: string) => void;
  isHighlighted?: boolean;
  onHighlight?: (id: string | null) => void;
  onConnectionHover?: (blockId: string | null) => void;
  onConnectionLock?: (blockId: string) => void;
  isConnectionLocked?: boolean;
  allBlocks?: TextBlock[];
  onChangeType?: (id: string, newType: ContentType) => void;
}

// Custom Markdown components for styling
const MarkdownComponents = {
  p: ({ children }: any) => <p className="mb-3 last:mb-0">{children}</p>,
  ul: ({ children }: any) => (
    <ul className="mb-3 list-disc pl-4 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol className="mb-3 list-decimal pl-4 last:mb-0">{children}</ol>
  ),
  li: ({ children }: any) => <li className="mb-1">{children}</li>,
  h1: ({ children }: any) => (
    <h1 className="mb-2 text-base font-bold">{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="mb-2 text-base font-bold">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="mb-1 text-sm font-bold">{children}</h3>
  ),
  a: ({ href, children }: any) => {
    let displayDomain = href;
    try {
      displayDomain = new URL(href).hostname.replace("www.", "");
    } catch {}
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-0.5 text-primary hover:underline"
      >
        <LinkIcon className="h-2.5 w-2.5" />
        {children || displayDomain}
      </a>
    );
  },
  strong: ({ children }: any) => (
    <strong className="font-bold text-foreground">{children}</strong>
  ),
};

// Simple heuristic to detect RTL text (Arabic/Hebrew)
function isRTL(text: string): boolean {
  const rtlChars = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0590-\u05FF]/;
  return rtlChars.test(text);
}

export const TileCard = memo(function TileCard({
  block,
  isCollapsed,
  onDelete,
  onEdit,
  onEditAnnotation,
  onReEnrich,
  onToggleCollapse,
  onTogglePin,
  onToggleSubTask,
  onDeleteSubTask,
  isHighlighted,
  onHighlight,
  onConnectionHover,
  onConnectionLock,
  isConnectionLocked,
  allBlocks,
  hideCollapse = false,
  onChangeType,
}: TileCardProps) {
  const effectiveCollapsed = hideCollapse ? false : isCollapsed;
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(block.text);
  const [isHovered, setIsHovered] = useState(false);
  const [isEditingAnnotation, setIsEditingAnnotation] = useState(false);
  const [editAnnotation, setEditAnnotation] = useState(block.annotation || "");
  const [isMounted, setIsMounted] = useState(false);
  const [isFooterExpanded, setIsFooterExpanded] = useState(false);
  const [editingMinHeight, setEditingMinHeight] = useState<number | undefined>(
    undefined,
  );
  // Toggle between synthesized (annotation) and raw text view
  const [showRawText, setShowRawText] = useState(false);
  const [isTypePickerOpen, setIsTypePickerOpen] = useState(false);
  const [pickerRect, setPickerRect] = useState<DOMRect | null>(null);
  const typeChangeButtonRef = useRef<HTMLButtonElement>(null);
  const typePickerDropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const annotationRef = useRef<HTMLTextAreaElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const formattedTime = useMemo(() => {
    if (!isMounted) return "";
    return new Date(block.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [block.timestamp, isMounted]);

  const config =
    CONTENT_TYPE_CONFIG[block.contentType] || CONTENT_TYPE_CONFIG.general;
  const Icon = config.icon;
  const accent = config.accentVar;
  const isTask = block.contentType === "task";

  // Auto-size + focus for the main text editing textarea
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const el = textareaRef.current;
      el.focus();
      el.selectionStart = el.value.length;
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [isEditing]);

  // Auto-size + focus for annotation editing textarea
  useEffect(() => {
    if (isEditingAnnotation && annotationRef.current) {
      const el = annotationRef.current;
      el.focus();
      el.selectionStart = el.value.length;
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [isEditingAnnotation]);

  // Close type picker on outside click or Escape.
  useEffect(() => {
    if (!isTypePickerOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsTypePickerOpen(false);
    };
    const handleMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        !typeChangeButtonRef.current?.contains(t) &&
        !typePickerDropdownRef.current?.contains(t)
      ) {
        setIsTypePickerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [isTypePickerOpen]);

  const handleSave = useCallback(() => {
    if (editText.trim() && editText !== block.text) {
      onEdit(block.id, editText);
    }
    setIsEditing(false);
    setEditingMinHeight(undefined);
  }, [editText, block.id, block.text, onEdit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape") {
        setEditText(block.text);
        setIsEditing(false);
        setEditingMinHeight(undefined);
      }
    },
    [handleSave, block.text],
  );

  const handleAnnotationSave = useCallback(() => {
    onEditAnnotation(block.id, editAnnotation);
    setIsEditingAnnotation(false);
    setEditingMinHeight(undefined);
  }, [editAnnotation, block.id, onEditAnnotation]);

  const handleAnnotationKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleAnnotationSave();
      }
      if (e.key === "Escape") {
        setEditAnnotation(block.annotation || "");
        setIsEditingAnnotation(false);
        setEditingMinHeight(undefined);
      }
    },
    [handleAnnotationSave, block.annotation],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (effectiveCollapsed) return;
      const target = e.target as HTMLElement;
      if (target.closest("a") || target.closest("button")) return;
      
      setEditingMinHeight(cardRef.current?.offsetHeight);
      if (target.closest(".annotation-area")) {
        setEditAnnotation(block.annotation || "");
        setIsEditingAnnotation(true);
        return;
      }
      setEditText(block.text);
      setIsEditing(true);
    },
    [block.text, block.annotation, effectiveCollapsed],
  );

  const isTextRTL = useMemo(() => isRTL(block.text), [block.text]);
  const isAnnotationRTL = useMemo(
    () => isRTL(block.annotation || ""),
    [block.annotation],
  );

  const toggleCollapse = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleCollapse(block.id);
      if (isEditing) {
        setIsEditing(false);
        setEditingMinHeight(undefined);
      }
      if (isEditingAnnotation) {
        setIsEditingAnnotation(false);
        setEditingMinHeight(undefined);
      }
    },
    [block.id, onToggleCollapse, isEditing, isEditingAnnotation],
  );

  // Derive dimmed state from connection lock
  const isDimmed = isConnectionLocked && !isHighlighted;

  // Unified render structure
  return (
    <motion.div
      ref={cardRef}
      layout
      whileHover={{ scale: 1.005 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 28,
        layout: { duration: 0.3 },
      }}
      className={`group relative flex h-auto w-full flex-col overflow-hidden rounded-[16px] border-0 bg-card shadow-sm hover:shadow-md transition-shadow duration-200 ${
        isHighlighted ? "z-10 bg-primary/[0.04]" : ""
      } ${isDimmed ? "opacity-30 saturate-50" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        if (effectiveCollapsed && !hideCollapse) {
          onToggleCollapse(block.id);
        }
      }}
      onDoubleClick={handleDoubleClick}
      style={{
        minHeight:
          (isEditing || isEditingAnnotation) && editingMinHeight
            ? editingMinHeight
            : undefined,
      }}
    >
      {/* Header */}
      <div
        className={`relative flex items-center justify-between px-5 pt-3 pb-1.5 shrink-0 ${isTextRTL ? "flex-row-reverse" : ""}`}
      >
        <div
          className={`flex items-center gap-2 overflow-hidden ${isTextRTL ? "flex-row-reverse" : ""}`}
        >
          {/* Collapse toggle */}
          {!hideCollapse && (
            <button
              onClick={toggleCollapse}
              className="shrink-0 rounded-md p-0.5 text-muted-foreground/40 hover:text-foreground hover:bg-secondary/60 transition-all"
              aria-label={
                effectiveCollapsed ? "Expand panel" : "Collapse panel"
              }
            >
              {effectiveCollapsed ? (
                isTextRTL ? (
                  <ChevronLeft className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}

          {/* Type indicator — colored dot + icon + label */}
          <span className="flex items-center gap-1.5" style={{ color: accent }}>
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: accent }}
            />
            <Icon className="h-3 w-3 shrink-0" />
            <span className="text-[11px] font-medium" style={{ color: accent }}>
              {config.label}
            </span>
          </span>

          {block.isUnrelated && !effectiveCollapsed && (
            <span className="rounded-md px-2 py-0.5 text-[10px] font-medium text-muted-foreground/50 bg-secondary/50 ">
              Not related to topic
            </span>
          )}
        </div>

        {/* Header right: timestamp + action buttons */}
        <div
          className={`flex items-center gap-1.5 shrink-0 ${isTextRTL ? "flex-row-reverse" : ""}`}
        >
          {/* Timestamp */}
          <span className="text-[10px] text-muted-foreground/50 mr-1">
            {formattedTime}
          </span>

          {/* Connection indicator */}
          {block.influencedBy && block.influencedBy.length > 0 && (
            <button
              onMouseEnter={() =>
                !isConnectionLocked && onConnectionHover?.(block.id)
              }
              onMouseLeave={() =>
                !isConnectionLocked && onConnectionHover?.(null)
              }
              onClick={(e) => {
                e.stopPropagation();
                if (isConnectionLocked) {
                  onConnectionHover?.(null);
                }
                onConnectionLock?.(block.id);
              }}
              className={`rounded-md p-1 transition-all duration-150 ${
                isConnectionLocked
                  ? "bg-secondary/80 text-foreground/70"
                  : "text-muted-foreground/40 hover:text-foreground hover:bg-secondary/60"
              }`}
              title={
                isConnectionLocked
                  ? "Click to unlock connections"
                  : `Show ${block.influencedBy.length} connection${block.influencedBy.length !== 1 ? "s" : ""} — click to lock`
              }
            >
              <div className="flex items-center gap-[2.5px]">
                <div className="h-1.25 w-1.25 rounded-full bg-current" />
                <div
                  className={`h-0.75 w-0.75 rounded-full bg-current ${isConnectionLocked ? "opacity-100" : "opacity-60"}`}
                />
                <div className="h-1.25 w-1.25 rounded-full bg-current" />
              </div>
            </button>
          )}

          {/* Thesis refresh */}
          {!effectiveCollapsed && block.contentType === "thesis" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReEnrich(block.id, "thesis");
              }}
              className="rounded-md p-1 text-muted-foreground/40 hover:text-foreground hover:bg-secondary/60 transition-all"
              title="Refresh thesis synthesis"
              disabled={block.isEnriching}
            >
              <RefreshCw
                className={`h-3 w-3 ${block.isEnriching ? "animate-spin opacity-50" : ""}`}
              />
            </button>
          )}

          {/* Pin toggle */}
          {!effectiveCollapsed && onTogglePin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(block.id);
              }}
              className={`rounded-md p-1 transition-all ${
                block.isPinned
                  ? "text-foreground bg-secondary/80"
                  : "text-muted-foreground/40 hover:text-foreground hover:bg-secondary/60"
              }`}
              aria-label={block.isPinned ? "Unpin note" : "Pin note"}
              title={block.isPinned ? "Unpin note" : "Pin note"}
            >
              <Pin
                className={`h-3 w-3 transition-transform ${block.isPinned ? "fill-current" : "-rotate-45"}`}
              />
            </button>
          )}

          {/* Change-type button */}
          {onChangeType && !effectiveCollapsed && (
            <button
              ref={typeChangeButtonRef}
              onClick={(e) => {
                e.stopPropagation();
                if (typeChangeButtonRef.current) {
                  setPickerRect(
                    typeChangeButtonRef.current.getBoundingClientRect(),
                  );
                }
                setIsTypePickerOpen((v) => !v);
              }}
              className={`rounded-md p-1 transition-all ${
                isTypePickerOpen
                  ? "bg-secondary/80 text-foreground"
                  : "text-muted-foreground/40 hover:text-foreground hover:bg-secondary/60"
              }`}
              title="Change type"
            >
              <Tag className="h-3 w-3" />
            </button>
          )}

          {/* Delete */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(block.id);
            }}
            className="rounded-md p-1 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 transition-all"
            aria-label="Delete note"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Type picker — rendered via portal so it escapes tile overflow:hidden */}
      {isTypePickerOpen &&
        pickerRect &&
        onChangeType &&
        isMounted &&
        createPortal(
          <div
            ref={typePickerDropdownRef}
            className="rounded-xl border border-border/80 bg-card shadow-xl overflow-hidden"
            style={{
              position: "fixed",
              top: pickerRect.bottom + 8,
              right: window.innerWidth - pickerRect.right,
              minWidth: 220,
              zIndex: 9999,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="px-4 pt-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
              Change type
            </p>
            <div className="grid grid-cols-2 gap-1 p-2 pt-1">
              {(
                Object.entries(CONTENT_TYPE_CONFIG) as [
                  ContentType,
                  (typeof CONTENT_TYPE_CONFIG)[ContentType],
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
                        setIsTypePickerOpen(false);
                      }}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-all ${
                        isActive
                          ? "bg-primary/10 ring-1 ring-primary/20"
                          : "hover:bg-secondary/60"
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: cfg.accentVar }}
                      />
                      <TypeIcon
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ color: cfg.accentVar }}
                      />
                      <span
                        className="text-[12px] font-medium"
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
          </div>,
          document.body,
        )}

      {/* Collapsed state */}
      {effectiveCollapsed && (
        <div className="px-6 py-4 overflow-hidden">
          <p className="text-[14px] leading-relaxed text-foreground/50 line-clamp-1 font-sans">
            {showRawText ? block.text : block.annotation || block.text}
          </p>
        </div>
      )}

      {/* Expanded state */}
      {!effectiveCollapsed && (
        <div className="flex flex-col overflow-hidden">
          {/* Body */}
          <div
            className={`flex flex-col overflow-y-auto overflow-x-hidden px-6 py-4 custom-scrollbar ${isTextRTL ? "rtl-text" : ""}`}
          >
            <div className="flex flex-col">
              {isEditing ? (
                <div className="flex w-full flex-col gap-3">
                  <textarea
                    ref={textareaRef}
                    value={editText}
                    onChange={(e) => {
                      setEditText(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = e.target.scrollHeight + "px";
                    }}
                    onKeyDown={handleKeyDown}
                    onBlur={handleSave}
                    className={`w-full resize-none rounded-lg bg-background border border-border/80 px-3 py-2.5 text-[14px] leading-relaxed text-foreground/90 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 focus:outline-none transition-all ${isTextRTL ? "rtl-text" : ""}`}
                    style={{ minHeight: "3rem" }}
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground/50">
                      Enter to save · Shift+Enter for newline · Esc to cancel
                    </span>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSave();
                      }}
                      className="ml-auto rounded-md p-1.5 transition-all hover:opacity-80 active:scale-95"
                      style={{
                        backgroundColor: accent,
                        color: "var(--background)",
                      }}
                      aria-label="Save edit"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full">
                  {block.isError && (
                    <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
                      <span className="text-[12px] text-red-400/80 leading-relaxed flex-1">
                        {block.statusText === "no-api-key" ? (
                          <>
                            AI enrichment failed — no API key. Open the{" "}
                            <strong className="text-red-300">
                              ☰ sidebar → Settings
                            </strong>{" "}
                            to add your API key.
                          </>
                        ) : block.statusText ? (
                          <>{block.statusText}</>
                        ) : (
                          "Enrichment failed."
                        )}
                      </span>
                      {block.statusText !== "no-api-key" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onReEnrich(block.id);
                          }}
                          className="shrink-0 rounded-md p-1.5 text-red-400/80 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                          title="Retry enrichment"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                  <div className={block.isEnriching ? "shimmer-body" : ""}>
                    {isTask && block.subTasks ? (
                      <div className="flex flex-col gap-2">
                        {block.subTasks.map((st) => (
                          <div
                            key={st.id}
                            className="group/task flex items-start gap-3 rounded-lg bg-secondary/30 p-3 transition-colors hover:bg-secondary/60"
                          >
                            <button
                              onClick={() => onToggleSubTask?.(block.id, st.id)}
                              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-all"
                              style={{
                                backgroundColor: st.isDone
                                  ? "var(--type-task)"
                                  : "transparent",
                                borderColor: st.isDone
                                  ? "var(--type-task)"
                                  : "color-mix(in oklch, var(--type-task) 50%, transparent)",
                              }}
                            >
                              {st.isDone && (
                                <Check className="h-2.5 w-2.5 text-white" />
                              )}
                            </button>
                            <span
                              className={`flex-1 text-[13px] leading-relaxed transition-all ${
                                st.isDone
                                  ? "text-foreground/40 line-through"
                                  : "text-foreground/90"
                              }`}
                            >
                              {st.text}
                            </span>
                            <button
                              onClick={() => {
                                if (confirm("Delete this task?")) {
                                  onDeleteSubTask?.(block.id, st.id);
                                }
                              }}
                              className="opacity-0 group-hover/task:opacity-100 rounded-md p-1 hover:bg-red-500/20 transition-all text-red-400"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      renderBody(
                        showRawText
                          ? block.text
                          : block.annotation || block.text,
                        config.bodyStyle,
                        accent,
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Raw text toggle hint + Annotation (shown when in raw mode) */}
              {!isEditing && (
                <div
                  className={`annotation-area flex flex-col ${showRawText && block.annotation ? "mt-4 pt-4 " : ""}`}
                >
                  {showRawText && block.annotation && (
                    <div className="flex flex-col gap-2">
                      <div
                        className={`prose-sm prose-invert max-w-none text-[12px] leading-snug text-muted-foreground/60 italic ${
                          block.isEnriching ? "shimmer-body" : ""
                        } ${isAnnotationRTL ? "rtl-text" : ""}`}
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={MarkdownComponents as any}
                        >
                          {block.annotation}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* Annotation editing (when triggered via footer button) */}
              {!isEditing && isEditingAnnotation && (
                <div
                  className={`annotation-area mt-4 pt-4  flex flex-col ${
                    isEditingAnnotation ? "flex-1" : ""
                  }`}
                >
                  {isEditingAnnotation ? (
                    <div className="flex flex-1 w-full flex-col gap-3">
                      <textarea
                        ref={annotationRef}
                        value={editAnnotation}
                        onChange={(e) => setEditAnnotation(e.target.value)}
                        onKeyDown={handleAnnotationKeyDown}
                        onBlur={handleAnnotationSave}
                        className={`flex-1 w-full resize-none rounded-lg bg-background border border-border/80 px-3 py-2.5 text-[13px] leading-relaxed text-foreground/90 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 focus:outline-none transition-all ${
                          isAnnotationRTL ? "rtl-text" : ""
                        }`}
                        placeholder="Start writing..."
                      />
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] text-muted-foreground/50">
                          Enter to save · Shift+Enter for newline · Esc to
                          cancel
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div
                        className={`prose-sm prose-invert max-w-none text-[12px] leading-snug text-muted-foreground/60 italic ${
                          block.isEnriching ? "shimmer-body" : ""
                        } ${isAnnotationRTL ? "rtl-text" : ""}`}
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={MarkdownComponents as any}
                        >
                          {block.annotation || ""}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Confidence bar */}
          {block.confidence !== undefined &&
            block.confidence !== null &&
            !isEditing && (
              <div
                className={`px-5 pb-3 shrink-0 transition-opacity duration-300 ${
                  isHovered ? "opacity-100" : "opacity-0"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-muted-foreground/50">
                    Confidence
                  </span>
                  <span className="text-[10px] text-muted-foreground/50">
                    {Math.round(block.confidence)}%
                  </span>
                </div>
                <div className="h-0.5 w-full overflow-hidden rounded-full bg-secondary/60">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(5, block.confidence)}%`,
                      background: accent,
                      opacity: 0.5,
                    }}
                  />
                </div>
              </div>
            )}

          {/* Footer */}
          <div
            ref={footerRef}
            className={`relative flex shrink-0 flex-col transition-all duration-300 ease-in-out ${
              isFooterExpanded ? "bg-secondary/[0.06]" : "bg-secondary/[0.03]"
            }`}
          >
            <div
              className={`flex items-start justify-between px-6 py-3 ${
                isFooterExpanded ? "gap-3" : "items-center"
              }`}
            >
              <div
                className={`flex flex-1 items-start gap-2 overflow-hidden ${
                  isFooterExpanded ? "flex-wrap" : ""
                }`}
              >
                <div
                  className={`flex items-start gap-2 overflow-hidden ${
                    isFooterExpanded ? "flex-wrap mb-1" : ""
                  }`}
                >
                  {/* Category tag */}
                  <span
                    className="rounded-md px-2.5 py-1 text-[11px] font-medium flex items-center gap-1.5 shrink-0"
                    style={{
                      background: `color-mix(in oklch, ${accent} 10%, transparent)`,
                      color: accent,
                    }}
                  >
                    <span className="opacity-50">#</span>
                    <span className="truncate max-w-30">
                      {block.category || "no-topic"}
                    </span>
                  </span>

                  {/* Influences */}
                  {block.influencedBy && block.influencedBy.length > 0 && (
                    <div className="group/influences relative">
                      <div
                        className="flex items-center gap-1.5 rounded-md px-2.5 py-1 bg-secondary/50  cursor-help transition-all hover:bg-secondary/80"
                        onMouseEnter={() =>
                          block.influencedBy?.forEach((id) => onHighlight?.(id))
                        }
                        onMouseLeave={() =>
                          block.influencedBy?.forEach(() => onHighlight?.(null))
                        }
                      >
                        <Sparkles className="h-3 w-3 text-muted-foreground/50" />
                        <span className="text-[10px] font-medium text-muted-foreground/60">
                          {block.influencedBy.length}{" "}
                          {block.influencedBy.length === 1 ? "link" : "links"}
                        </span>
                      </div>

                      {/* Hover Tooltip */}
                      <div className="absolute bottom-full left-0 mb-2 w-56 p-3 rounded-xl bg-card border border-border/80 shadow-xl opacity-0 translate-y-2 pointer-events-none group-hover/influences:opacity-100 group-hover/influences:translate-y-0 transition-all z-100">
                        <h5 className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-2 pb-1.5 border-b border-border/30">
                          Connected nodes
                        </h5>
                        <div className="flex flex-col gap-1.5">
                          {block.influencedBy.slice(0, 5).map((id, i) => {
                            const linked = allBlocks?.find((b) => b.id === id);
                            return (
                              <div
                                key={i}
                                className="flex items-start gap-2 overflow-hidden"
                              >
                                <div
                                  className="h-1.5 w-1.5 rounded-full shrink-0 mt-1"
                                  style={{ backgroundColor: accent }}
                                />
                                <span
                                  className="text-[11px] text-foreground/70 truncate leading-tight"
                                  title={linked ? linked.text || "" : id}
                                >
                                  {linked
                                    ? (linked.text || "").substring(0, 48) +
                                      ((linked.text || "").length > 48
                                        ? "…"
                                        : "")
                                    : `#${id.slice(0, 8)}`}
                                </span>
                              </div>
                            );
                          })}
                          {block.influencedBy.length > 5 && (
                            <span className="text-[10px] text-muted-foreground/50 mt-1">
                              +{block.influencedBy.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {block.influencedBy && block.influencedBy.length > 1 && (
                  <button
                    onClick={() => setIsFooterExpanded(!isFooterExpanded)}
                    className={`rounded-md p-1 transition-all ${
                      isFooterExpanded
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground/40 hover:text-muted-foreground/60"
                    }`}
                  >
                    {isFooterExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3 -rotate-90" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
});

// Finds bare https?:// URLs in plain text and returns React nodes with
// clickable <a> links mixed into the surrounding text.
function linkifyText(text?: string): React.ReactNode {
  if (!text) return text;
  const URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = URL_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    // Strip trailing punctuation that's unlikely part of the URL
    const raw = m[0].replace(/[.,;:!?)>\]]+$/, "");
    let domain = raw;
    try {
      domain = new URL(raw).hostname.replace("www.", "");
    } catch {}
    parts.push(
      <a
        key={m.index}
        href={raw}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline"
      >
        <LinkIcon className="h-2.5 w-2.5 shrink-0" />
        {domain}
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 0 ? text : parts;
}

function renderBody(
  text: string,
  bodyStyle: string | undefined,
  accent: string,
) {
  switch (bodyStyle) {
    case "blockquote":
      return (
        <div
          className="pl-3"
          style={{ borderLeft: `2px solid ${accent}`, opacity: 0.9 }}
        >
          <p className="text-base italic leading-relaxed text-foreground/90">
            {linkifyText(text)}
          </p>
        </div>
      );
    case "italic":
      return (
        <p className="text-base italic leading-relaxed text-foreground/90">
          {linkifyText(text)}
        </p>
      );
    case "muted-italic":
      return (
        <div className="relative pl-6">
          <Quote 
            className="absolute -top-1 left-0 h-5 w-5 opacity-30" 
            style={{ color: accent, fill: accent }} 
          />
          <p className="text-base leading-relaxed text-foreground/80">
            {linkifyText(text)}
          </p>
        </div>
      );
    case "checkbox": {
      const isDone = text.toLowerCase().startsWith("[x]");
      const displayText = text
        .replace(/^\[[\sx]?\]\s*/i, "")
        .replace(/^(todo|fixme|hack)\s*/i, "");
      return (
        <div
          className={`flex items-start gap-2 ${isRTL(text) ? "flex-row-reverse" : ""}`}
        >
          <div
            className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-md border"
            style={{
              borderColor: accent,
              background: isDone ? accent : "transparent",
            }}
          >
            {isDone && (
              <Check
                className="h-2.5 w-2.5"
                style={{ color: "var(--background)" }}
              />
            )}
          </div>
          <p
            className="text-sm leading-relaxed text-foreground/90"
            style={{
              textDecoration: isDone ? "line-through" : "none",
              opacity: isDone ? 0.6 : 1,
            }}
          >
            {linkifyText(displayText)}
          </p>
        </div>
      );
    }
    case "thesis":
      return (
        <div className="flex flex-col gap-4">
          <p className="text-lg font-medium leading-relaxed tracking-tight text-foreground prose-invert">
            {linkifyText(text)}
          </p>
          <div className="h-px w-full bg-linear-to-r from-transparent via-primary/20 to-transparent" />
        </div>
      );
    default:
      return (
        <p className="text-[14px] leading-relaxed text-foreground/90 font-sans">
          {linkifyText(text)}
        </p>
      );
  }
}
