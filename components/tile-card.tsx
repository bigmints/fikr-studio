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
  PanelRight,
  MoreHorizontal,
} from "lucide-react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownComponents } from "./markdown-components";
import { CONTENT_TYPE_CONFIG, type ContentType } from "@/lib/content-types";
import { analytics } from "@/lib/analytics";

export interface TextBlock {
  id: string;
  text: string;
  timestamp: number;
  contentType: ContentType;
  category?: string;
  title?: string;
  isEnriching?: boolean;
  statusText?: string;
  isError?: boolean;
  annotation?: string;
  confidence?: number | null;
  sources?: { url: string; title: string; siteName: string }[];
  influencedBy?: { id: string; type: string }[];
  isUnrelated?: boolean;
  isPinned?: boolean;
  subTasks?: { id: string; text: string; isDone: boolean; timestamp: number }[];
  /** True when the note was created by an MCP client (agent/tool) */
  fromMcp?: boolean;
  /** True when the note arrived pre-synthesized via create_note_synthesized.
   *  These notes skip the UI enrichment pass and are stored with full annotation. */
  fromSkill?: boolean;
  mergeSuggestion?: { targetId: string };
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
  onOpenDetail?: (id: string) => void;
  onMerge?: (sourceId: string, targetId: string) => void;
  onDismissMerge?: (id: string) => void;
}

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
  onOpenDetail,
  onMerge,
  onDismissMerge,
}: TileCardProps) {
  const effectiveCollapsed = hideCollapse ? false : isCollapsed;
  const [isHovered, setIsHovered] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isFooterExpanded, setIsFooterExpanded] = useState(false);
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

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (effectiveCollapsed) return;
      const target = e.target as HTMLElement;
      if (target.closest("a") || target.closest("button")) return;

      if (onOpenDetail) {
        analytics.track("note_open_detail", { blockId: block.id });
        onOpenDetail(block.id);
      }
    },
    [effectiveCollapsed, onOpenDetail, block.id],
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
    },
    [block.id, onToggleCollapse],
  );

  // Derive dimmed state from connection lock
  const isDimmed = isConnectionLocked && !isHighlighted;

  // Unified render structure
  return (
    <motion.div
      ref={cardRef}
      layout
      whileHover={{ scale: 1.01, y: -2 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 28,
        layout: { duration: 0.3 },
      }}
      className={`group relative flex h-auto w-full flex-col overflow-hidden rounded-[12px] border bg-card transition-all duration-300 ${
        isHighlighted
          ? "z-10 border-[rgba(60,166,166,0.30)] bg-[rgba(60,166,166,0.03)] shadow-[0_4px_24px_rgba(60,166,166,0.15)]"
          : "border-[rgba(16,43,36,0.07)] hover:border-[rgba(16,43,36,0.13)] shadow-2xs hover:shadow-md"
      } ${isDimmed ? "opacity-25 saturate-0" : ""} ${onOpenDetail ? "cursor-pointer" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        if (onHighlight) {
          onHighlight(block.id);
        }
        if (onOpenDetail) {
          onOpenDetail(block.id);
        } else if (effectiveCollapsed && !hideCollapse) {
          onToggleCollapse(block.id);
        }
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Header */}
      <div
        className={`relative flex items-center justify-between px-4 pt-3 pb-1 shrink-0 ${isTextRTL ? "flex-row-reverse" : ""}`}
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

          {/* Type indicator — dot opacity encodes confidence (high=solid, low=faint) */}
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0 transition-opacity"
            style={{
              backgroundColor: accent,
              opacity: block.confidence != null
                ? Math.max(0.2, block.confidence / 100) * 0.85
                : 0.6,
            }}
            title={config.label + (block.confidence != null ? ` · ${Math.round(block.confidence)}% confidence` : "")}
          />

          {block.isUnrelated && !effectiveCollapsed && (
            <span className="rounded-md px-2 py-0.5 text-xs font-medium text-muted-foreground/60 bg-secondary/50 ">
              Not related to topic
            </span>
          )}
        </div>

        {/* Header right: action buttons */}
        <div
          className={`flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${isTextRTL ? "flex-row-reverse" : ""}`}
        >
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
            <p className="px-4 pt-3 pb-2 text-xs font-semibold text-muted-foreground/60">
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
                        className="text-xs font-medium"
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
          <p className="text-sm leading-relaxed text-foreground/50 line-clamp-1 font-sans">
            {block.title || (showRawText ? block.text : block.annotation || block.text)}
          </p>
        </div>
      )}

      {/* Expanded state */}
      {!effectiveCollapsed && (
        <div className="flex flex-col overflow-hidden">
          {/* Body */}
          <div
            className={`flex flex-col overflow-y-auto overflow-x-hidden px-4 pt-2 pb-3 custom-scrollbar ${isTextRTL ? "rtl-text" : ""}`}
          >
            <div className="flex flex-col">
              <div className="w-full">
                {block.isError && (
                  <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
                    <span className="text-xs text-red-400/80 leading-relaxed flex-1">
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
                {block.title && !showRawText && (
                  <h3 className={`text-sm font-bold mb-2 leading-tight text-foreground ${block.isEnriching ? "shimmer-text" : ""}`}>
                    {block.title}
                  </h3>
                )}
                <div>
                  {renderBody(
                    showRawText ? block.text : block.annotation || block.text,
                    config.bodyStyle,
                    accent,
                    block.isEnriching,
                    config.icon,
                  )}
                </div>
              </div>

              {/* Raw text toggle hint + Annotation (shown when in raw mode) */}
              <div
                className={`annotation-area flex flex-col ${showRawText && block.annotation ? "mt-4 pt-4 " : ""}`}
              >
                {showRawText && block.annotation && (
                  <div className="flex flex-col gap-2">
                    <div
                      className={`prose-sm dark:prose-invert max-w-none text-xs leading-snug text-muted-foreground/60 italic ${
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
            </div>
          </div>



          {/* Footer */}
          <div
            ref={footerRef}
            className="relative flex shrink-0 flex-col"
          >
            <div
              className="flex items-center justify-between px-5 py-2.5"
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
                  {/* Timestamp */}
                  <span className="text-xs text-muted-foreground/50 self-center mr-1 tabular-nums">
                    {formattedTime}
                  </span>

                  {/* Category tag — plain muted text, no pill background */}
                  <span className="text-xs text-muted-foreground/55 shrink-0">
                    #{block.category || "no-topic"}
                  </span>

                  {/* Influences */}
                  {block.influencedBy && block.influencedBy.length > 0 && (
                    <div className="group/influences relative">
                      <div
                        className="flex items-center gap-1.5 rounded-md px-2.5 py-1 bg-secondary/50 cursor-help transition-all hover:bg-secondary/80 shrink-0"
                        onMouseEnter={() =>
                          block.influencedBy?.forEach((edge) =>
                            onHighlight?.(
                              typeof edge === "string" ? edge : edge.id,
                            ),
                          )
                        }
                        onMouseLeave={() =>
                          block.influencedBy?.forEach(() => onHighlight?.(null))
                        }
                      >
                        <Sparkles className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                        <span className="text-xs font-medium text-muted-foreground/65 whitespace-nowrap">
                          {block.influencedBy.length}{" "}
                          {block.influencedBy.length === 1 ? "link" : "links"}
                        </span>
                      </div>

                      {/* Hover Tooltip */}
                      <div className="absolute bottom-full left-0 mb-2 w-56 p-3 rounded-xl bg-card border border-border/80 shadow-xl opacity-0 translate-y-2 pointer-events-none group-hover/influences:opacity-100 group-hover/influences:translate-y-0 transition-all z-100">
                        <h5 className="text-xs font-semibold text-muted-foreground/65 mb-2 pb-1.5 border-b border-border/30">
                          Connected notes
                        </h5>
                        <div className="flex flex-col gap-1.5">
                          {block.influencedBy.slice(0, 5).map((edge, i) => {
                            const linkId =
                              typeof edge === "string" ? edge : edge.id;
                            const linkType =
                              typeof edge === "string" ? "related" : edge.type;
                            const linked = allBlocks?.find(
                              (b) => b.id === linkId,
                            );
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
                                  className="text-xs text-foreground/70 truncate leading-tight"
                                  title={linked ? linked.text || "" : linkId}
                                >
                                  {linked
                                    ? (linked.text || "").substring(0, 48) +
                                      ((linked.text || "").length > 48
                                        ? "…"
                                        : "")
                                    : `#${linkId.slice(0, 8)}`}
                                </span>
                                <span className="text-xs text-muted-foreground/55 ml-auto pt-0.5 shrink-0">
                                  {linkType}
                                </span>
                              </div>
                            );
                          })}
                          {block.influencedBy.length > 5 && (
                            <span className="text-xs text-muted-foreground/60 mt-1">
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

            {block.mergeSuggestion && (
              <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500/70" />
                  <span className="text-amber-500/90 text-xs font-medium">
                    Similar note detected
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMerge?.(block.id, block.mergeSuggestion!.targetId);
                    }}
                    className="text-xs font-medium text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                  >
                    Merge
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismissMerge?.(block.id);
                    }}
                    className="p-1 rounded-md text-amber-500/50 hover:text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
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
  isEnriching?: boolean,
  Icon?: React.ElementType,
) {
  const shimmerClass = isEnriching ? "shimmer-text" : "";
  switch (bodyStyle) {
    case "thesis":
      return (
        <div className="flex flex-col gap-4">
          <div
            className={`prose-sm dark:prose-invert max-w-none text-lg font-medium leading-relaxed tracking-tight text-foreground ${shimmerClass}`}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={MarkdownComponents as any}
            >
              {text}
            </ReactMarkdown>
          </div>
          <div className="h-px w-full bg-linear-to-r from-transparent via-primary/20 to-transparent" />
        </div>
      );
    default:
      return (
        <div
          className={`prose-sm dark:prose-invert max-w-none text-sm leading-relaxed text-foreground/90 font-sans ${shimmerClass}`}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={MarkdownComponents as any}
          >
            {text}
          </ReactMarkdown>
        </div>
      );
  }
}
