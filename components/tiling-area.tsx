"use client";
import { EmptyWorkspace } from "@/components/empty-workspace";

import React, {
  useMemo,
  useRef,
  useEffect,
  useState,
  useCallback,
} from "react";
import { analytics } from "@/lib/analytics";
import { TileCard, type TextBlock } from "@/components/tile-card";
import { getRelatedIds, useModKey } from "@/lib/utils";
import { isEditableShortcutTarget } from "@/lib/keyboard-shortcuts";
import { TilingMinimap } from "./tiling-minimap";
import { CONTENT_TYPE_CONFIG, type ContentType } from "@/lib/content-types";
import { ArrowUpDown, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TilingAreaProps {
  blocks: TextBlock[];
  collapsedIds: Set<string>;
  onDelete: (id: string) => void;
  onEdit: (id: string, newText: string) => void;
  onEditAnnotation: (id: string, newAnnotation: string) => void;
  onReEnrich: (id: string, newCategory?: string) => void;
  onChangeType: (
    id: string,
    newType: import("@/lib/content-types").ContentType,
  ) => void;
  onToggleCollapse: (id: string) => void;
  onTogglePin: (id: string) => void;
  onToggleSubTask: (id: string, subTaskId: string) => void;
  onDeleteSubTask: (id: string, subTaskId: string) => void;
  highlightedBlockId?: string | null;
  onHighlight: (id: string | null) => void;
  selectedBlockId?: string | null;
  onOpenDetail?: (id: string) => void;
  onMerge?: (sourceId: string, targetId: string) => void;
  onDismissMerge?: (id: string) => void;
}

export function TilingArea({
  blocks,
  collapsedIds,
  onDelete,
  onEdit,
  onEditAnnotation,
  onReEnrich,
  onChangeType,
  onToggleCollapse,
  onTogglePin,
  onToggleSubTask,
  onDeleteSubTask,
  highlightedBlockId,
  onHighlight,
  selectedBlockId,
  onOpenDetail,
  onMerge,
  onDismissMerge,
}: TilingAreaProps) {
  const mod = useModKey();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── Filter + Sort state (local, no prop drilling) ──────────────────
  const [filterType, setFilterType] = useState<ContentType | null>(null);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "confidence" | "pinned">("newest");

  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(
    null,
  );
  const [lockedConnectionId, setLockedConnectionId] = useState<string | null>(
    null,
  );

  const activeConnectionId = lockedConnectionId ?? hoveredConnectionId;

  const relatedIds = useMemo<Set<string>>(
    () =>
      activeConnectionId
        ? getRelatedIds(activeConnectionId, blocks)
        : new Set(),
    [activeConnectionId, blocks],
  );

  const handleConnectionHover = useCallback((id: string | null) => {
    setHoveredConnectionId(id);
  }, []);

  const handleConnectionLock = useCallback((id: string) => {
    setLockedConnectionId((prev) => {
      if (prev === id) {
        analytics.track("connection_unlock", { blockId: id });
        return null;
      }
      analytics.track("connection_lock", { blockId: id });
      return id;
    });
  }, []);

  // Clear lock when locked block's connections change
  useEffect(() => {
    if (!lockedConnectionId) return;
    const lockedBlock = blocks.find((b) => b.id === lockedConnectionId);
    if (!lockedBlock || !lockedBlock.influencedBy?.length) {
      setLockedConnectionId(null);
    }
  }, [blocks, lockedConnectionId]);

  // Escape key clears lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLockedConnectionId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Masonry blocks: filter → sort
  const masonryBlocks = useMemo(() => {
    let result = [...blocks];

    // Filter by type
    if (filterType) result = result.filter(b => b.contentType === filterType);

    // Sort
    result.sort((a, b) => {
      if (sortBy === "pinned") {
        const pinDiff = (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
        if (pinDiff !== 0) return pinDiff;
        return b.timestamp - a.timestamp;
      }
      if (sortBy === "confidence") {
        return (b.confidence ?? 0) - (a.confidence ?? 0);
      }
      if (sortBy === "oldest") return a.timestamp - b.timestamp;
      // newest (default)
      return b.timestamp - a.timestamp;
    });

    return result;
  }, [blocks, filterType, sortBy]);

  // Unique types present in the current block set (for filter pills)
  const presentTypes = useMemo(() => {
    const types = new Set(blocks.map(b => b.contentType));
    return (Object.keys(CONTENT_TYPE_CONFIG) as ContentType[]).filter(t => types.has(t));
  }, [blocks]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableShortcutTarget(e.target)) return;

      if (
        e.key === "ArrowRight" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowUp"
      ) {
        e.preventDefault();
        if (masonryBlocks.length === 0) return;

        const currentIndex = highlightedBlockId
          ? masonryBlocks.findIndex((b) => b.id === highlightedBlockId)
          : -1;
        const nextIndex = (e.key === "ArrowRight" || e.key === "ArrowDown")
          ? (currentIndex < masonryBlocks.length - 1 ? currentIndex + 1 : 0)
          : (currentIndex > 0 ? currentIndex - 1 : masonryBlocks.length - 1);
        
        const nextId = masonryBlocks[nextIndex].id;
        onHighlight(nextId);
        
        // Keep sidebar in sync if it is open
        if (selectedBlockId && onOpenDetail) {
          onOpenDetail(nextId);
        }

        // Auto-scroll
        const el = document.getElementById(`tile-${nextId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }

      if (e.key === "Enter" && highlightedBlockId && onOpenDetail) {
        e.preventDefault();
        onOpenDetail(highlightedBlockId);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [masonryBlocks, highlightedBlockId, selectedBlockId, onHighlight, onOpenDetail]);

  // Check if scrollable for minimap
  const [isScrollable, setIsScrollable] = useState(false);
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const check = () =>
      setIsScrollable(container.scrollHeight > container.clientHeight);
    // Delay check to allow layout to settle
    const timer = setTimeout(check, 100);
    const ro = new ResizeObserver(check);
    ro.observe(container);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, [masonryBlocks.length]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background">

      {/* ── Filter + Sort bar — only when there are notes ─────────────── */}
      {blocks.length >= 3 && (
        <div
          className="flex items-center gap-2 px-6 py-2 shrink-0 border-b border-border/30 relative z-10"
        >
          <div className="flex items-center gap-1.5 flex-1 overflow-x-auto no-scrollbar">
            {filterType && (
              <button
                onClick={() => setFilterType(null)}
                className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-full transition-all text-primary bg-primary/10"
              >
                <X className="w-2.5 h-2.5" />
                Clear
              </button>
            )}
            {presentTypes.map(type => {
              const cfg = CONTENT_TYPE_CONFIG[type];
              const isActive = filterType === type;
              return (
                <button
                  key={type}
                  onClick={() => setFilterType(isActive ? null : type)}
                  className={`text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full transition-all whitespace-nowrap ${
                    !isActive && "text-muted-foreground/60 hover:text-foreground"
                  }`}
                  style={isActive ? {
                    color: cfg.accentVar,
                    background: `color-mix(in oklch, ${cfg.accentVar} 12%, transparent)`,
                    border: `1px solid color-mix(in oklch, ${cfg.accentVar} 25%, transparent)`,
                  } : {
                    border: "1px solid transparent"
                  }}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>

          <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
            <SelectTrigger aria-label="Sort notes" className="h-8 w-auto shrink-0 gap-1.5 border-0 bg-transparent px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground/70 hover:bg-secondary/60">
              <ArrowUpDown className="size-3" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="confidence">Confidence</SelectItem>
              <SelectItem value="pinned">Pinned</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Masonry Grid */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto custom-scrollbar p-6 relative"
        onClick={(e) => {
          if (e.target === e.currentTarget) setLockedConnectionId(null);
        }}
      >
        {masonryBlocks.length > 0 ? (
          <div
            className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-3 space-y-3"
            style={{
              columnCount: "auto",
              columnWidth: "300px",
              columnGap: "12px",
            }}
          >
            {masonryBlocks.map((block) => {
              const isDimmed =
                activeConnectionId !== null && !relatedIds.has(block.id);
              return (
                <div
                  key={block.id}
                  id={`tile-${block.id}`}
                  className="break-inside-avoid mb-3"
                >
                  <div
                    className={`transition-[opacity,filter] duration-300 ${isDimmed ? "opacity-15 saturate-0" : "opacity-100"}`}
                  >
                    <TileCard
                      block={block}
                      isCollapsed={false}
                      hideCollapse={true}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      onEditAnnotation={onEditAnnotation}
                      onReEnrich={onReEnrich}
                      onChangeType={onChangeType}
                      onToggleCollapse={onToggleCollapse}
                      onTogglePin={onTogglePin}
                      onToggleSubTask={onToggleSubTask}
                      onDeleteSubTask={onDeleteSubTask}
                      isHighlighted={highlightedBlockId === block.id}
                      onHighlight={onHighlight}
                      onConnectionHover={handleConnectionHover}
                      isConnectionLocked={lockedConnectionId === block.id}
                      allBlocks={blocks}
                      onOpenDetail={onOpenDetail}
                      onMerge={onMerge}
                      onDismissMerge={onDismissMerge}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Empty state */}
        {masonryBlocks.length === 0 && <EmptyWorkspace title="masonry view" />}
      </div>
    </div>
  );
}
