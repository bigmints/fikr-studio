"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Pin, Search, SlidersHorizontal, X } from "lucide-react";
import { EmptyWorkspace } from "@/components/empty-workspace";
import type { TextBlock } from "@/components/tile-card";
import { CONTENT_TYPE_CONFIG, type ContentType } from "@/lib/content-types";
import { isEditableShortcutTarget } from "@/lib/keyboard-shortcuts";

interface ListAreaProps {
  blocks: TextBlock[];
  highlightedBlockId?: string | null;
  onHighlight: (id: string | null) => void;
  selectedBlockId?: string | null;
  selectedBlockIds?: Set<string>;
  onOpenDetail?: (id: string, multiSelect?: boolean) => void;
}

type SortOption = "newest" | "oldest" | "confidence" | "pinned";

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

function notePreview(block: TextBlock, title: string) {
  const plainText = block.text
    .replace(/^#+\s*/gm, "")
    .replace(/[*_`>#()~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plainText === title ? "" : plainText;
}

export function ListArea({
  blocks,
  highlightedBlockId,
  onHighlight,
  selectedBlockId,
  selectedBlockIds,
  onOpenDetail,
}: ListAreaProps) {
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState<ContentType | "all">("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

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
      onOpenDetail?.(nextId);
      document.getElementById(`list-item-${nextId}`)?.scrollIntoView({ block: "nearest" });
    };

    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [highlightedBlockId, listBlocks, onHighlight, onOpenDetail, selectedBlockId]);

  const filtersActive = query.trim().length > 0 || filterType !== "all";

  return (
    <section className="flex h-full min-w-0 flex-col overflow-hidden bg-background" aria-label="Notes inbox">
      <header className="shrink-0 px-4 pb-3 pt-3">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h1 className="font-display text-lg font-medium leading-tight text-foreground">Notes</h1>
            <span
              className="text-xs font-medium text-muted-foreground/70"
              aria-label={`${listBlocks.length} ${listBlocks.length === 1 ? "note" : "notes"}`}
            >
              {listBlocks.length === blocks.length
                ? blocks.length
                : `${listBlocks.length}/${blocks.length}`}
            </span>
          </div>
          {filtersActive && (
            <button
              type="button"
              onClick={() => { setQuery(""); setFilterType("all"); }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_2rem_2rem] gap-2">
          <label className="flex h-9 min-w-0 items-center gap-2.5 rounded-md bg-secondary/70 px-3 transition-colors focus-within:bg-secondary focus-within:ring-2 focus-within:ring-ring/30">
            <Search className="size-4 shrink-0 text-muted-foreground/75" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notes"
              className="min-w-0 flex-1 bg-transparent text-sm leading-5 text-foreground outline-none placeholder:text-muted-foreground/70"
              aria-label="Search notes in this space"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear note search">
                <X className="size-3 text-muted-foreground/80 hover:text-foreground" />
              </button>
            )}
          </label>

          <label
            className="relative flex size-8 items-center justify-center rounded-md bg-secondary/60 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-within:ring-2 focus-within:ring-ring/30"
            title={filterType === "all" ? "Filter notes" : `Filtered by ${CONTENT_TYPE_CONFIG[filterType].label}`}
          >
            <SlidersHorizontal className="size-4" />
            <select
              value={filterType}
              onChange={(event) => setFilterType(event.target.value as ContentType | "all")}
              className="absolute inset-0 cursor-pointer appearance-none opacity-0"
              aria-label="Filter notes by type"
            >
              <option value="all">All types</option>
              {presentTypes.map((type) => (
                <option key={type} value={type}>{CONTENT_TYPE_CONFIG[type].label}</option>
              ))}
            </select>
            {filterType !== "all" && (
              <span className="absolute right-1 top-1 size-1.5 rounded-full bg-foreground" aria-hidden="true" />
            )}
          </label>
          <label
            className="relative flex size-8 items-center justify-center rounded-md bg-secondary/60 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-within:ring-2 focus-within:ring-ring/30"
            title={`Sort: ${sortBy === "newest" ? "Newest first" : sortBy === "oldest" ? "Oldest first" : sortBy === "pinned" ? "Pinned first" : "Confidence"}`}
          >
            <ArrowUpDown className="size-4" />
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortOption)}
              className="absolute inset-0 cursor-pointer appearance-none opacity-0"
              aria-label="Sort notes"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="pinned">Pinned first</option>
              <option value="confidence">Confidence</option>
            </select>
          </label>
        </div>
      </header>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        {listBlocks.length === 0 ? (
          blocks.length === 0 ? (
            <EmptyWorkspace title="notes" />
          ) : (
            <div className="flex h-40 flex-col items-center justify-center px-6 text-center">
              <Search className="mb-2 h-5 w-5 text-muted-foreground/60" />
              <p className="text-[12px] font-medium text-muted-foreground/65">No matching notes</p>
              <p className="mt-1 text-xs text-muted-foreground/70">Try another search or filter.</p>
            </div>
          )
        ) : (
          <div role="listbox" aria-label="Notes">
            {listBlocks.map((block) => {
              const title = noteTitle(block);
              const preview = notePreview(block, title);
              const config = CONTENT_TYPE_CONFIG[block.contentType] || CONTENT_TYPE_CONFIG.general;
              const isSelected = selectedBlockId === block.id || selectedBlockIds?.has(block.id);
              const isHighlighted = highlightedBlockId === block.id;

              return (
                <button
                  type="button"
                  key={block.id}
                  id={`list-item-${block.id}`}
                  role="option"
                  aria-selected={Boolean(isSelected)}
                  onClick={(event) => onOpenDetail?.(block.id, event.shiftKey || event.metaKey || event.ctrlKey)}
                  onMouseEnter={() => onHighlight(block.id)}
                  onMouseLeave={() => onHighlight(selectedBlockId ?? null)}
                  className={`group relative w-full px-4 py-3.5 text-left transition-colors ${
                    isSelected
                      ? "bg-foreground/[0.08]"
                      : isHighlighted
                        ? "bg-foreground/[0.05]"
                        : "hover:bg-foreground/[0.035]"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-start gap-2">
                        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-5 text-foreground/95">{title}</p>
                        <time className="shrink-0 pt-0.5 text-xs font-medium leading-5 text-muted-foreground/75">{relativeTime(block.timestamp)}</time>
                      </div>
                      {preview && <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted-foreground/85">{preview}</p>}
                      <div className="mt-2 flex min-w-0 items-center gap-1.5 text-xs leading-4">
                        <span className="truncate font-semibold" style={{ color: config.accentVar }}>{config.label}</span>
                        {block.category && (
                          <>
                            <span className="text-muted-foreground/60">·</span>
                            <span className="truncate text-muted-foreground/75">{block.category}</span>
                          </>
                        )}
                        {block.isPinned && <Pin className="ml-auto h-2.5 w-2.5 shrink-0 fill-current text-foreground/70" />}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
