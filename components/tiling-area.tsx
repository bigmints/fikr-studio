"use client";

import React, {
  useMemo,
  useRef,
  useEffect,
  useState,
  useCallback,
} from "react";
import { TileCard, type TextBlock } from "@/components/tile-card";
import { getRelatedIds, useModKey } from "@/lib/utils";
import { TilingMinimap } from "./tiling-minimap";

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
}: TilingAreaProps) {
  const mod = useModKey();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
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
    setLockedConnectionId((prev) => (prev === id ? null : id));
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

  // Masonry blocks (sorted: pinned first, then oldest first)
  const masonryBlocks = useMemo(() => {
    return blocks
      .filter((b) => b.contentType !== "task")
      .sort((a, b) => {
        const pinDiff = (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
        if (pinDiff !== 0) return pinDiff;
        return a.timestamp - b.timestamp;
      });
  }, [blocks]);

  const taskBlock = useMemo(
    () => blocks.find((b) => b.contentType === "task"),
    [blocks],
  );

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
      {/* Task Header stays sticky at top */}
      {taskBlock && (
        <div
          className={`w-full shrink-0 p-3 z-10 transition-[opacity,filter] duration-300 ${activeConnectionId && !relatedIds.has(taskBlock.id) ? "opacity-15 saturate-0" : "opacity-100"}`}
        >
          <TileCard
            block={taskBlock}
            isCollapsed={collapsedIds.has(taskBlock.id)}
            onDelete={onDelete}
            onEdit={onEdit}
            onEditAnnotation={onEditAnnotation}
            onReEnrich={onReEnrich}
            onChangeType={onChangeType}
            onToggleCollapse={onToggleCollapse}
            onTogglePin={onTogglePin}
            onToggleSubTask={onToggleSubTask}
            onDeleteSubTask={onDeleteSubTask}
            isHighlighted={highlightedBlockId === taskBlock.id}
            onHighlight={onHighlight}
            onConnectionHover={handleConnectionHover}
            onConnectionLock={handleConnectionLock}
            isConnectionLocked={lockedConnectionId === taskBlock.id}
            allBlocks={blocks}
          />
        </div>
      )}

      {/* Masonry Grid */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto custom-scrollbar p-4 relative"
        onClick={(e) => {
          if (e.target === e.currentTarget) setLockedConnectionId(null);
        }}
      >
        {masonryBlocks.length > 0 ? (
          <div
            className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-4 space-y-4"
            style={{
              columnCount: "auto",
              columnWidth: "280px",
              columnGap: "16px",
            }}
          >
            {masonryBlocks.map((block) => {
              const isDimmed =
                activeConnectionId !== null && !relatedIds.has(block.id);
              return (
                <div
                  key={block.id}
                  id={`tile-${block.id}`}
                  className="break-inside-avoid mb-4"
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
                      onConnectionLock={handleConnectionLock}
                      isConnectionLocked={lockedConnectionId === block.id}
                      allBlocks={blocks}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Empty state */}
        {masonryBlocks.length === 0 && !taskBlock && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-background">
            <div className="flex flex-col items-center text-center max-w-xl px-6">
              <div className="mb-6 opacity-80 mix-blend-plus-lighter">
                <img
                  src="logo-icon.png"
                  alt="FikrPad"
                  className="h-14 w-14 object-contain"
                />
              </div>
              <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-8 shadow-sm">
                <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-[pulse_3s_ease-in-out_infinite]"></span>
                AI-Powered Spatial Thinking
              </div>

              <div className="flex flex-col gap-3 mb-6">
                <h1 className="text-foreground text-[clamp(1.5rem,3vw,2.25rem)] font-bold tracking-tight leading-[1.2]">
                  "If you think you know something, but don't write it down, you
                  only think you know it."
                </h1>
                <a
                  href="https://www.lamport.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-muted-foreground/50 hover:text-foreground/80 transition-colors pointer-events-auto"
                >
                  — Leslie Lamport
                </a>
              </div>

              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-12 max-w-md mx-auto">
                FikrPad transforms your thinking into an organised, spatial
                workspace. Write freely, and let the AI categorise, connect, and
                synthesise.
              </p>

              <div className="flex flex-col items-center gap-3">
                <p className="text-[12px] text-foreground/70 uppercase tracking-[0.15em] whitespace-nowrap font-mono bg-secondary/50 px-5 py-2.5 rounded-lg border border-border/80 shadow-sm">
                  {`type anything · #type to classify · ${mod}K commands`}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>


    </div>
  );
}
