"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, Check, Pin, Search, SlidersHorizontal, X } from "lucide-react";
import { EmptyWorkspace } from "@/components/empty-workspace";
import type { TextBlock } from "@/components/tile-card";
import { CONTENT_TYPE_CONFIG, type ContentType } from "@/lib/content-types";
import { isEditableShortcutTarget } from "@/lib/keyboard-shortcuts";
import { NOTE_DRAG_MIME } from "@/lib/note-drag";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface ListAreaProps {
  blocks: TextBlock[];
  highlightedBlockId?: string | null;
  onHighlight: (id: string | null) => void;
  selectedBlockId?: string | null;
  selectedBlockIds?: Set<string>;
  onOpenDetail?: (id: string, multiSelect?: boolean) => void;
  onSelectAll?: (ids: string[]) => void;
  onClearSelection?: () => void;
  selectionMode: boolean;
  onSelectionModeChange: (active: boolean) => void;
  sortBy: SortOption;
  onSortByChange: (sort: SortOption) => void;
}

export type SortOption = "newest" | "oldest" | "confidence" | "pinned";

function relativeTime(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "Now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
}

function noteTitle(block: TextBlock) {
  if (block.title?.trim()) return block.title.trim();
  return block.text
    .split("\n")
    .find((line) => line.trim())
    ?.replace(/^#+\s*/, "")
    .trim() || "Untitled";
}

export function ListArea({
  blocks,
  highlightedBlockId,
  onHighlight,
  selectedBlockId,
  selectedBlockIds,
  onOpenDetail,
  onSelectAll,
  onClearSelection,
  selectionMode,
  onSelectionModeChange,
  sortBy,
  onSortByChange,
}: ListAreaProps) {
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState<ContentType | "all">("all");
  const previousSelectedCount = useRef(0);

  const presentTypes = useMemo(() => {
    const types = new Set(blocks.map((block) => block.contentType));
    return (Object.keys(CONTENT_TYPE_CONFIG) as ContentType[]).filter((type) => types.has(type));
  }, [blocks]);

  const listBlocks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const result = blocks.filter((block) => {
      if (filterType !== "all" && block.contentType !== filterType) return false;
      if (!normalizedQuery) return true;
      return [block.title, block.text, block.category, CONTENT_TYPE_CONFIG[block.contentType]?.label]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(normalizedQuery));
    });

    return result.sort((a, b) => {
      if (sortBy === "pinned") {
        const pinDifference = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
        return pinDifference || b.timestamp - a.timestamp;
      }
      if (sortBy === "confidence") return (b.confidence ?? 0) - (a.confidence ?? 0);
      if (sortBy === "oldest") return a.timestamp - b.timestamp;
      return b.timestamp - a.timestamp;
    });
  }, [blocks, filterType, query, sortBy]);

  useEffect(() => {
    const handleKeys = (event: KeyboardEvent) => {
      if (isEditableShortcutTarget(event.target)) return;

      if (selectionMode && event.key === "Escape") {
        event.preventDefault();
        onSelectionModeChange(false);
        onClearSelection?.();
        return;
      }

      if (selectionMode && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        onSelectAll?.(listBlocks.map((block) => block.id));
        return;
      }

      if (selectionMode && event.key === " " && highlightedBlockId) {
        event.preventDefault();
        onOpenDetail?.(highlightedBlockId, true);
        return;
      }

      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      if (!listBlocks.length) return;
      event.preventDefault();

      const currentIndex = selectedBlockId
        ? listBlocks.findIndex((block) => block.id === selectedBlockId)
        : highlightedBlockId
          ? listBlocks.findIndex((block) => block.id === highlightedBlockId)
          : -1;
      const nextIndex = event.key === "ArrowDown"
        ? (currentIndex + 1 + listBlocks.length) % listBlocks.length
        : (currentIndex - 1 + listBlocks.length) % listBlocks.length;
      const nextId = listBlocks[nextIndex].id;
      onHighlight(nextId);
      if (!selectionMode) onOpenDetail?.(nextId);
      document.getElementById(`list-item-${nextId}`)?.scrollIntoView({ block: "nearest" });
    };

    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [
    highlightedBlockId,
    listBlocks,
    onClearSelection,
    onHighlight,
    onOpenDetail,
    onSelectAll,
    onSelectionModeChange,
    selectedBlockId,
    selectionMode,
  ]);

  const filtersActive = query.trim().length > 0 || filterType !== "all";
  const selectedCount = selectedBlockIds?.size ?? 0;
  const allVisibleSelected = listBlocks.length > 0 && listBlocks.every((block) => selectedBlockIds?.has(block.id));

  useEffect(() => {
    if (selectedCount > 0 && !selectionMode) onSelectionModeChange(true);
    if (previousSelectedCount.current > 0 && selectedCount === 0 && selectionMode) {
      onSelectionModeChange(false);
    }
    previousSelectedCount.current = selectedCount;
  }, [onSelectionModeChange, selectedCount, selectionMode]);

  const leaveSelectionMode = () => {
    onSelectionModeChange(false);
    onClearSelection?.();
  };

  return (
    <section className="flex h-full min-w-0 flex-col overflow-hidden bg-background" aria-label="Notes inbox">
      <header className="shrink-0 border-b border-border/55 px-4 pb-3.5 pt-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <h1 className="fikr-toolbar-title">Notes</h1>
            <span
              className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold tabular-nums text-primary"
              aria-label={`${listBlocks.length} ${listBlocks.length === 1 ? "note" : "notes"}`}
            >
              {listBlocks.length === blocks.length
                ? blocks.length
                : `${listBlocks.length} of ${blocks.length}`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {selectionMode ? (
              <>
                {!allVisibleSelected && listBlocks.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelectAll?.(listBlocks.map((block) => block.id))}
                    className="h-8 px-2 text-xs font-medium text-muted-foreground"
                  >
                    Select all
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={leaveSelectionMode}
                  className="h-8 px-2 text-xs font-semibold"
                >
                  Done
                </Button>
              </>
            ) : (
              <>
                {filtersActive && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setQuery(""); setFilterType("all"); }}
                    className="h-8 gap-1 px-2 text-xs font-medium text-muted-foreground"
                  >
                    <X className="h-3 w-3" /> Clear
                  </Button>
                )}
                {blocks.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onSelectionModeChange(true);
                    }}
                    className="h-8 px-2 text-xs font-medium text-muted-foreground"
                    title="Select notes to move, delete, or recategorize"
                  >
                    Select
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_2.25rem_2.25rem] gap-1.5">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.8} />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notes"
              className="h-9 min-w-0 rounded-lg pl-9 pr-8 text-sm"
              aria-label="Search notes in this space"
            />
            {query && (
              <Button type="button" variant="ghost" size="icon-xs" onClick={() => setQuery("")} aria-label="Clear note search" className="absolute right-1.5 top-1/2 -translate-y-1/2">
                <X className="size-3" />
              </Button>
            )}
          </div>

          <Select value={filterType} onValueChange={(value) => setFilterType(value as ContentType | "all")}>
            <SelectTrigger
              aria-label={`Filter notes by type, current: ${filterType === "all" ? "All types" : CONTENT_TYPE_CONFIG[filterType].label}`}
              title={filterType === "all" ? "Filter notes" : `Filtered by ${CONTENT_TYPE_CONFIG[filterType].label}`}
              className="relative size-9 justify-center rounded-lg border-border/70 bg-background p-0 text-muted-foreground shadow-xs hover:bg-secondary/60 hover:text-foreground [&>svg:last-child]:hidden"
            >
              <SlidersHorizontal className="size-3.5" strokeWidth={1.8} />
              <span className="sr-only"><SelectValue /></span>
              {filterType !== "all" && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-foreground" aria-hidden="true" />}
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">All types</SelectItem>
              {presentTypes.map((type) => <SelectItem key={type} value={type}>{CONTENT_TYPE_CONFIG[type].label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(value) => onSortByChange(value as SortOption)}>
            <SelectTrigger
              aria-label={`Sort notes, current: ${sortBy === "newest" ? "Newest first" : sortBy === "oldest" ? "Oldest first" : sortBy === "pinned" ? "Pinned first" : "Confidence"}`}
              title={`Sort: ${sortBy === "newest" ? "Newest first" : sortBy === "oldest" ? "Oldest first" : sortBy === "pinned" ? "Pinned first" : "Confidence"}`}
              className="size-9 justify-center rounded-lg border-border/70 bg-background p-0 text-muted-foreground shadow-xs hover:bg-secondary/60 hover:text-foreground [&>svg:last-child]:hidden"
            >
              <ArrowUpDown className="size-3.5" strokeWidth={1.8} />
              <span className="sr-only"><SelectValue /></span>
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="pinned">Pinned first</SelectItem>
              <SelectItem value="confidence">Confidence</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        {listBlocks.length === 0 ? (
          blocks.length === 0 ? (
            <EmptyWorkspace title="notes" />
          ) : (
            <div className="flex h-40 flex-col items-center justify-center px-6 text-center">
              <Search className="mb-2 h-5 w-5 text-muted-foreground/60" />
              <p className="text-xs font-medium text-muted-foreground/65">No matching notes</p>
              <p className="mt-1 text-xs text-muted-foreground/70">Try another search or filter.</p>
            </div>
          )
        ) : (
          <div role="listbox" aria-label="Notes" className="space-y-0.5 px-2 py-2">
            {listBlocks.map((block) => {
              const title = noteTitle(block);
              const config = CONTENT_TYPE_CONFIG[block.contentType] || CONTENT_TYPE_CONFIG.general;
              const isSelected = selectedBlockId === block.id || selectedBlockIds?.has(block.id);
              const isHighlighted = highlightedBlockId === block.id;

              return (
                <Button
                  type="button"
                  variant="ghost"
                  key={block.id}
                  id={`list-item-${block.id}`}
                  role="option"
                  aria-selected={Boolean(isSelected)}
                  title={selectionMode ? "Click to select" : "Drag to another workspace to move"}
                  draggable
                  onDragStart={(event) => {
                    const draggedIds = selectedBlockIds?.has(block.id)
                      ? Array.from(selectedBlockIds)
                      : [block.id];
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData(NOTE_DRAG_MIME, JSON.stringify(draggedIds));
                  }}
                  onClick={(event) => onOpenDetail?.(
                    block.id,
                    selectionMode || event.shiftKey || event.metaKey || event.ctrlKey,
                  )}
                  onMouseEnter={() => onHighlight(block.id)}
                  onMouseLeave={() => onHighlight(selectedBlockId ?? null)}
                  className={`group relative h-auto w-full justify-start rounded-lg px-3 py-3 text-left transition-colors active:cursor-grabbing ${
                    isSelected
                      ? "bg-primary/10 ring-1 ring-inset ring-primary/15"
                      : isHighlighted
                        ? "bg-secondary/70"
                        : "hover:bg-secondary/55"
                  }`}
                >
                  {isSelected && <span className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-primary" aria-hidden="true" />}
                  <div className="flex min-w-0 items-start gap-2.5">
                    {selectionMode && (
                      <span
                        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          selectedBlockIds?.has(block.id)
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-background"
                        }`}
                        aria-hidden="true"
                      >
                        {selectedBlockIds?.has(block.id) && <Check className="size-3" strokeWidth={2.5} />}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="min-w-0">
                        <div className="flex items-start gap-2.5">
                          <p className="line-clamp-2 min-w-0 flex-1 whitespace-normal text-sm font-semibold leading-5 text-foreground/95">{title}</p>
                          <time className="shrink-0 pt-px text-xs font-medium tabular-nums text-muted-foreground">{relativeTime(block.timestamp)}</time>
                        </div>
                        <div className="mt-1.5 flex min-w-0 items-center gap-1.5 leading-4">
                          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <span className="size-1.5 rounded-full" style={{ backgroundColor: config.accentVar }} aria-hidden="true" />
                            {config.label}
                          </span>
                          {block.category && (
                            <>
                              <span className="text-xs text-muted-foreground/50">·</span>
                              <span className="truncate text-xs font-normal text-muted-foreground">{block.category}</span>
                            </>
                          )}
                          {block.isPinned && <Pin className="ml-auto h-2.5 w-2.5 shrink-0 fill-current text-foreground/70" />}
                        </div>
                      </div>
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
