"use client";

import { EmptyWorkspace } from "@/components/empty-workspace";
import React, { useMemo, useState, useEffect } from "react";
import type { TextBlock } from "@/components/tile-card";
import { CONTENT_TYPE_CONFIG, type ContentType } from "@/lib/content-types";
import { ArrowUpDown, X } from "lucide-react";

interface ListAreaProps {
  blocks: TextBlock[];
  highlightedBlockId?: string | null;
  onHighlight: (id: string | null) => void;
  selectedBlockId?: string | null;
  onOpenDetail?: (id: string) => void;
}

export function ListArea({
  blocks,
  highlightedBlockId,
  onHighlight,
  selectedBlockId,
  onOpenDetail,
}: ListAreaProps) {
  // ── Filter + Sort state ──────────────────
  const [filterType, setFilterType] = useState<ContentType | null>(null);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "confidence" | "pinned">("newest");

  // Filter → sort blocks
  const listBlocks = useMemo(() => {
    let result = [...blocks];

    if (filterType) result = result.filter(b => b.contentType === filterType);

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

  const presentTypes = useMemo(() => {
    const types = new Set(blocks.map(b => b.contentType));
    return (Object.keys(CONTENT_TYPE_CONFIG) as ContentType[]).filter(t => types.has(t));
  }, [blocks]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (listBlocks.length === 0) return;

        const currentIndex = highlightedBlockId
          ? listBlocks.findIndex((b) => b.id === highlightedBlockId)
          : -1;
        const nextIndex = e.key === "ArrowDown"
          ? (currentIndex < listBlocks.length - 1 ? currentIndex + 1 : 0)
          : (currentIndex > 0 ? currentIndex - 1 : listBlocks.length - 1);
        
        const nextId = listBlocks[nextIndex].id;
        onHighlight(nextId);
        
        if (selectedBlockId && onOpenDetail) {
          onOpenDetail(nextId);
        }

        const el = document.getElementById(`list-item-${nextId}`);
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
  }, [listBlocks, highlightedBlockId, selectedBlockId, onHighlight, onOpenDetail]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background">
      {/* ── Filter + Sort bar ─────────────── */}
      {blocks.length >= 3 && (
        <div
          className="flex items-center gap-2 px-6 py-2 shrink-0 border-b border-border/30"
        >
          <div className="flex items-center gap-1.5 flex-1 overflow-x-auto no-scrollbar">
            {filterType && (
              <button
                onClick={() => setFilterType(null)}
                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.15em] px-2 py-1 rounded-full transition-all text-primary bg-primary/10"
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
                  className={`text-[10px] font-semibold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full transition-all whitespace-nowrap ${
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

          <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground/60">
            <ArrowUpDown className="w-3 h-3" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="text-[10px] font-semibold uppercase tracking-[0.12em] bg-transparent border-none outline-none cursor-pointer text-muted-foreground/70"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="confidence">Confidence</option>
              <option value="pinned">Pinned</option>
            </select>
          </div>
        </div>
      )}

      {/* ── List view ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {listBlocks.length === 0 ? (
          blocks.length === 0 ? <EmptyWorkspace title="list view" /> : <div className="flex items-center justify-center h-40 text-muted-foreground/40 text-sm">No notes match filter</div>
        ) : (
          <div className="flex flex-col w-full text-sm">
            <div className="sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border)_/_0.1)] flex items-center px-6 py-4">
              <div className="flex-1 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40">Note</div>
              <div className="w-32 hidden lg:block text-left text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40 shrink-0">Type</div>
              <div className="w-40 hidden md:block text-left text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40 shrink-0">Category</div>
              <div className="w-28 hidden xl:block text-right text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40 shrink-0 pr-4">Confidence</div>
              <div className="w-28 hidden sm:block text-right text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40 shrink-0">Added</div>
            </div>
            <div className="flex flex-col">
              {listBlocks.map((block) => {
                const isHighlighted = highlightedBlockId === block.id || selectedBlockId === block.id;
                const ago = (() => {
                  const s = Math.floor((Date.now() - block.timestamp) / 1000);
                  if (s < 60) return `Just now`;
                  const m = Math.floor(s / 60);
                  if (m < 60) return `${m}m ago`;
                  const h = Math.floor(m / 60);
                  if (h < 24) return `${h}h ago`;
                  return `${Math.floor(h / 24)}d ago`;
                })();
                const config = CONTENT_TYPE_CONFIG[block.contentType] || CONTENT_TYPE_CONFIG.general;

                return (
                  <div
                    key={block.id}
                    id={`list-item-${block.id}`}
                    onClick={() => onOpenDetail?.(block.id)}
                    onMouseEnter={() => onHighlight(block.id)}
                    className={`flex items-center px-6 py-4 border-b border-border/10 cursor-pointer transition-all duration-200 group ${
                      isHighlighted
                        ? "bg-primary/5 shadow-[inset_2px_0_0_0_hsl(var(--primary))]"
                        : "hover:bg-foreground/[0.02]"
                    }`}
                  >
                    <div className="flex-1 flex items-center gap-3 min-w-0 pr-6">
                      <span 
                        className="w-2 h-2 rounded-full shrink-0 shadow-[0_0_8px_0_currentColor] opacity-80 group-hover:opacity-100 transition-opacity"
                        style={{ 
                          backgroundColor: block.isEnriching ? "hsl(var(--muted-foreground))" : config.accentVar,
                          color: block.isEnriching ? "hsl(var(--muted-foreground))" : config.accentVar
                        }}
                      />
                      <p className="text-[14px] text-foreground/80 group-hover:text-foreground transition-colors truncate font-semibold tracking-tight">
                        {block.title || block.text || <span className="text-muted-foreground/30 italic font-normal">Untitled</span>}
                      </p>
                    </div>

                    <div className="w-32 hidden lg:flex items-center shrink-0 pr-4 min-w-0">
                      <span className="text-[12px] font-medium truncate" style={{ color: config.accentVar }}>
                        {config.label}
                      </span>
                    </div>
                    
                    <div className="w-40 hidden md:flex items-center shrink-0 pr-4 min-w-0">
                      <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-secondary/40 border border-border/40 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider truncate max-w-full">
                        <span className="truncate">{block.category || "General"}</span>
                      </div>
                    </div>

                    <div className="w-28 hidden xl:block text-right shrink-0 pr-4 min-w-0">
                      <span className="text-[12px] font-bold text-muted-foreground/40">
                        {block.confidence ? `${block.confidence}%` : "—"}
                      </span>
                    </div>

                    <div className="w-28 hidden sm:block text-right shrink-0 min-w-0">
                      <span className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-widest whitespace-nowrap">{ago}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
