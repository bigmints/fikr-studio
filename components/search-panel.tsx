"use client";

import * as React from "react";
import {
  Search,
  Sparkles,
  FileText,
  Globe,
  Zap,
  HelpCircle,
  CheckSquare,
  Lightbulb,
  Link,
  Quote,
  BookOpen,
  MessageCircle,
  ScrollText,
  Scale,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearch } from "@/lib/search-store";
import { generateSnippet } from "@/lib/search-store";
import { vectorIndex, textSearch } from "@/lib/vector-index";
import { analytics } from "@/lib/analytics";
import { getModelLoaded, isModelLoaded } from "@/lib/embeddings";

// ─── Content-Type Icon Mapping ───────────────────────────────────────────────

/**
 * Maps content type strings to their corresponding lucide-react icons.
 * Mirrors the icon mapping used in CONTENT_TYPE_CONFIG (lib/content-types.ts).
 */
const CONTENT_ICONS: Record<string, LucideIcon> = {
  entity: Globe,
  claim: Zap,
  question: HelpCircle,
  task: CheckSquare,
  idea: Lightbulb,
  reference: Link,
  quote: Quote,
  definition: BookOpen,
  opinion: MessageCircle,
  reflection: Sparkles,
  narrative: ScrollText,
  comparison: Scale,
  general: FileText,
  thesis: Sparkles,
};

/**
 * Resolve the icon component for a given content type string.
 * Falls back to FileText for unknown types.
 */
function getIconForType(contentType: string): LucideIcon {
  return CONTENT_ICONS[contentType] || FileText;
}

// ─── SearchPanel Props ───────────────────────────────────────────────────────

/**
 * Props for the SearchPanel component.
 *
 * This component renders inside the Cmd+K command palette, below the
 * existing command items. It displays semantic search results, loading
 * states, and keyboard-navigable result rows.
 */
export interface SearchPanelProps {
  /**
   * Called when the user selects a search result (via click or Enter).
   * Receives the block ID and the project ID it belongs to.
   */
  onSelectResult: (blockId: string, projectId: string) => void;

  /**
   * List of projects to resolve project names from IDs.
   */
  projects: Array<{ id: string; name: string }>;

  /**
   * Flat list of blocks to resolve note text by block ID.
   * Used to enrich search results with full text and content type.
   */
  blocks: Array<{ id: string; text: string; contentType: string }>;

  /**
   * Optional className to pass to the results list container.
   * Defaults to "max-h-60" if not provided.
   */
  listClassName?: string;
}

// ─── Spinner Component ───────────────────────────────────────────────────────

/**
 * Minimal CSS-only spinner for the loading state.
 * Deliberately avoids framer-motion to keep the command palette snappy.
 */
function SearchSpinner() {
  return (
    <div
      className="h-4 w-4 animate-spin border-[1.5px] border-muted-foreground/30 border-t-muted-foreground/80 rounded-full"
      role="status"
      aria-label="Searching"
    />
  );
}

// ─── SearchPanel Component ───────────────────────────────────────────────────

/**
 * Renders the semantic search results section inside the command palette.
 *
 * Displays:
 * - Section heading ("Search Results") when there are results or searching
 * - Loading spinner with status text during search
 * - Result rows with content-type icon, snippet, project name, score badge
 * - Empty state when no results match
 * - Keyboard-navigation highlight based on selectedIndex from search store
 *
 * The component reads state from the SearchProvider context and does not
 * manage any search-side-effects itself (that is handled by useSearchEffect).
 */
export function SearchPanel(props: SearchPanelProps) {
  const { onSelectResult, projects, blocks, listClassName } = props;
  const { state, selectIndex, selectNext, selectPrev } = useSearch();

  // Build lookup maps for fast enrichment
  const projectMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) {
      map.set(p.id, p.name);
    }
    return map;
  }, [projects]);

  const blockMap = React.useMemo(() => {
    const map = new Map<string, { text: string; contentType: string }>();
    for (const b of blocks) {
      map.set(b.id, { text: b.text, contentType: b.contentType });
    }
    return map;
  }, [blocks]);

  // Enrich raw search results with text, snippet, project name, content type
  const enrichedResults = React.useMemo(() => {
    return state.results.map((result) => {
      const blockData = blockMap.get(result.blockId);
      const projectName = projectMap.get(result.projectId) || "Unknown";
      const text = blockData?.text ?? result.text;
      const contentType = blockData?.contentType ?? result.contentType;
      const snippet = result.snippet || generateSnippet(text, 120);

      return {
        ...result,
        projectName,
        text,
        snippet,
        contentType,
      };
    });
  }, [state.results, blockMap, projectMap]);

  const { query, results, selectedIndex, isSearching, modelStatus } = state;

  // Determine visibility: only show when there's a meaningful query,
  // results are loading, or results exist
  const shouldShow = query.length >= 2 || isSearching || results.length > 0;

  // Handle selection via keyboard
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (results.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        analytics.track("search_keynav", { direction: "next" });
        selectNext();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        analytics.track("search_keynav", { direction: "prev" });
        selectPrev();
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const selected = results[selectedIndex];
        if (selected) {
          analytics.track("search_select", { type: selected.contentType });
          onSelectResult(selected.blockId, selected.projectId);
        }
      }
    },
    [results, selectedIndex, selectNext, selectPrev, onSelectResult],
  );

  if (!shouldShow) return null;

  // ── Model error state ──────────────────────────────────────────────────
  // Show the error banner but also render results if we have them from text search
  if (modelStatus === "error") {
    return (
      <>
        <div className="border-t border-border/40 px-4 py-3">
          <div className="flex items-center gap-2 text-muted-foreground/60">
            <Search className="h-3.5 w-3.5 opacity-50" />
            <span className="text-[11px] font-mono">
              AI search unavailable — using text match only
            </span>
          </div>
        </div>
        {results.length > 0 && (
          <div className="max-h-60 overflow-y-auto scrollbar-none">
            <div className="px-4 py-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                Search Results
              </span>
            </div>
            {results.map((result, index) => {
              const Icon = getIconForType(result.contentType);
              const isSelected = index === selectedIndex;
              const scorePercent = Math.round(result.score * 100);
              return (
                <button
                  key={result.blockId}
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent/50 ${
                    isSelected ? "bg-primary/10 border-l-2 border-primary" : ""
                  }`}
                  onMouseEnter={() => selectIndex(index)}
                  onClick={() => {
                    analytics.track("search_result_click", {
                      type: result.contentType,
                      project: result.projectName,
                    });
                    onSelectResult(result.blockId, result.projectId);
                  }}
                >
                  <Icon
                    className={`shrink-0 h-3.5 w-3.5 ${
                      isSelected ? "text-primary" : "opacity-40"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-mono truncate leading-snug">
                      {result.snippet || result.text}
                    </div>
                    <div className="text-[10px] text-muted-foreground/60">
                      {result.projectName}
                      {result.contentType !== "general"
                        ? ` · ${result.contentType}`
                        : ""}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground/40">
                    {scorePercent}%
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </>
    );
  }

  // ── Model loading state (first use) ────────────────────────────────────
  if (modelStatus === "loading" && !isSearching) {
    return (
      <div className="border-t border-border/40 px-4 py-3">
        <div className="flex items-center gap-2 text-muted-foreground/60">
          <SearchSpinner />
          <span className="text-[11px] font-mono">Loading AI search…</span>
        </div>
      </div>
    );
  }

  // ── Active search (loading) ────────────────────────────────────────────
  if (isSearching) {
    return (
      <div className="border-t border-border/40 px-4 py-3">
        <div className="flex items-center gap-2 text-muted-foreground/60">
          <SearchSpinner />
          <span className="text-[11px] font-mono">Searching notes…</span>
        </div>
      </div>
    );
  }

  // ── Results or empty state ─────────────────────────────────────────────
  return (
    <div
      className="border-t border-border/40"
      onKeyDown={handleKeyDown}
      role="listbox"
      aria-label="Search results"
    >
      {/* Section heading */}
      <div className="px-4 py-1.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-primary/60" />
          <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
            Search Results
          </span>
        </div>
      </div>

      {/* Results list */}
      <div
        className={cn(
          "overflow-y-auto scrollbar-none px-2 pb-1",
          listClassName || "max-h-60",
        )}
      >
        {enrichedResults.length === 0 ? (
          <div className="px-2 py-6 text-center">
            <p className="text-[12px] text-muted-foreground/50">
              No matching notes found
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground/30">
              Try different keywords or check your spelling
            </p>
          </div>
        ) : (
          enrichedResults.map((result, index) => {
            const Icon = getIconForType(result.contentType);
            const isSelected = index === selectedIndex;
            const scorePercent = Math.round(result.score * 100);

            return (
              <button
                key={result.blockId}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  analytics.track("search_result_click", {
                    type: result.contentType,
                    project: result.projectName,
                  });
                  onSelectResult(result.blockId, result.projectId);
                }}
                onMouseEnter={() => selectIndex(index)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                  isSelected && "bg-primary/10",
                )}
                style={
                  isSelected
                    ? { borderLeft: "2px solid hsl(var(--primary))" }
                    : undefined
                }
              >
                {/* Content-type icon */}
                <Icon
                  className={cn(
                    "shrink-0 opacity-50",
                    isSelected && "opacity-80",
                  )}
                />

                {/* Snippet + project */}
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      "text-[12px] font-mono leading-snug truncate",
                      isSelected
                        ? "text-foreground"
                        : "text-muted-foreground/80",
                    )}
                  >
                    {result.snippet}
                  </div>
                  <div className="text-[10px] text-muted-foreground/50 truncate">
                    {result.projectName}
                    {result.contentType !== "general" && (
                      <span className="ml-1.5 opacity-70">
                        · {result.contentType}
                      </span>
                    )}
                  </div>
                </div>

                {/* Score badge */}
                <span
                  className={cn(
                    "shrink-0 font-mono text-[10px] tabular-nums",
                    isSelected ? "text-primary/70" : "text-muted-foreground/40",
                  )}
                >
                  {scorePercent}%
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── useSearchEffect Hook ────────────────────────────────────────────────────

/**
 * Options for the useSearchEffect hook.
 */
export interface UseSearchEffectOptions {
  /**
   * Projects with their blocks, used for enrichment and reindexing.
   */
  projects: Array<{ id: string; name: string; blocks: any[] }>;

  /**
   * Optional callback fired when the embedding model status changes.
   */
  onModelStatusChange?: (
    status: "idle" | "loading" | "ready" | "error",
  ) => void;
}

/**
 * Connects the search store to the vector index.
 *
 * On mount:
 * - Loads the embedding model if not already loaded.
 * - Triggers a full reindex if the index is empty.
 *
 * During use:
 * - Watches `state.query` from the search store.
 * - Debounces search by 300ms.
 * - Runs semantic search via `vectorIndex.search()` and enriches
 *   results with text/snippets/project names from the provided data.
 * - Populates `state.results` via `setResults()`.
 *
 * This hook is designed to be called once inside the component that
 * owns the command palette (e.g., VimInput or its parent).
 */
export function useSearchEffect(options: UseSearchEffectOptions): void {
  const { projects, onModelStatusChange } = options;
  const { state, setQuery, setResults, setSearching, setModelStatus } =
    useSearch();

  // Track debounce timer across renders
  const debounceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const hasInitialized = React.useRef(false);

  // Resolve blocks flat list from projects for enrichment
  const allBlocks = React.useMemo(
    () =>
      projects.flatMap((p) =>
        p.blocks.map((b) => ({
          id: b.id,
          text: b.text,
          contentType: b.contentType,
          projectId: p.id,
        })),
      ),
    [projects],
  );

  const projectMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) {
      map.set(p.id, p.name);
    }
    return map;
  }, [projects]);

  const blockMap = React.useMemo(() => {
    const map = new Map<string, { text: string; contentType: string }>();
    for (const b of allBlocks) {
      map.set(b.id, { text: b.text, contentType: b.contentType });
    }
    return map;
  }, [allBlocks]);

  // ── Model loading + initial reindex ────────────────────────────────────
  React.useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const init = async () => {
      // If model is already loaded, skip
      if (isModelLoaded()) {
        setModelStatus("ready");
        onModelStatusChange?.("ready");

        // Reindex if index is empty
        if (vectorIndex.size() === 0 && projects.length > 0) {
          try {
            await vectorIndex.reindex(
              projects.map((p) => ({ id: p.id, blocks: p.blocks })),
            );
          } catch (e) {
            console.warn("[useSearchEffect] Initial reindex failed:", e);
          }
        }
        return;
      }

      setModelStatus("loading");
      onModelStatusChange?.("loading");

      try {
        await getModelLoaded();
        setModelStatus("ready");
        onModelStatusChange?.("ready");

        // Reindex now that the model is ready
        if (vectorIndex.size() === 0 && projects.length > 0) {
          try {
            await vectorIndex.reindex(
              projects.map((p) => ({ id: p.id, blocks: p.blocks })),
            );
          } catch (e) {
            console.warn("[useSearchEffect] Initial reindex failed:", e);
          }
        }
      } catch (error) {
        console.warn("[useSearchEffect] Model loading failed:", error);
        setModelStatus("error");
        onModelStatusChange?.("error");
      }
    };

    init();
  }, [projects, setModelStatus, onModelStatusChange]);

  // ── Watch query changes ────────────────────────────────────────────────
  React.useEffect(() => {
    // Clear any pending debounce
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    const q = state.query;

    // Empty query → clear results immediately
    if (!q || q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    // Text search is always available — run it immediately for instant results
    const textHits = textSearch(q, allBlocks, 20);
    const textEnriched = textHits.map((hit) => {
      const blockData = blockMap.get(hit.blockId);
      const proj = projects.find((p) =>
        allBlocks.some((b) => b.id === hit.blockId && b.projectId === p.id),
      );
      return {
        blockId: hit.blockId,
        projectId: proj?.id ?? "unknown",
        projectName: proj?.name ?? "Unknown",
        text: blockData?.text ?? "",
        snippet: generateSnippet(blockData?.text ?? "", 120),
        score: hit.score,
        contentType: blockData?.contentType ?? "general",
      };
    });
    setResults(textEnriched);
    setSearching(false);

    // Optionally enhance with semantic search when model is ready
    if (state.modelStatus === "ready") {
      debounceTimer.current = setTimeout(() => {
        (async () => {
          try {
            const semanticHits = await vectorIndex.search(q, 10);
            // Merge: if semantic result has higher score, replace text result
            if (semanticHits.length > 0) {
              const semanticMap = new Map(
                semanticHits.map((h) => [h.blockId, h]),
              );
              const merged = textEnriched.map((r) => {
                const semantic = semanticMap.get(r.blockId);
                if (semantic && semantic.score > r.score) {
                  return { ...r, score: semantic.score * 1.5 }; // Boost semantic
                }
                return r;
              });
              // Add semantic-only results not in text
              for (const s of semanticHits) {
                if (!textEnriched.find((r) => r.blockId === s.blockId)) {
                  const blockData = blockMap.get(s.blockId);
                  const proj = projects.find((p) => p.id === s.projectId);
                  merged.push({
                    blockId: s.blockId,
                    projectId: s.projectId,
                    projectName: proj?.name ?? "Unknown",
                    text: blockData?.text ?? "",
                    snippet: generateSnippet(blockData?.text ?? "", 120),
                    score: s.score * 1.5,
                    contentType: blockData?.contentType ?? "general",
                  });
                }
              }
              merged.sort((a, b) => b.score - a.score);
              setResults(merged.slice(0, 20));
            }
          } catch (e) {
            console.warn("[useSearchEffect] Semantic enhancement failed:", e);
          }
        })();
      }, 200);
    }

    // Cleanup: clear timer on unmount or query change
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    };
  }, [
    state.query,
    state.modelStatus,
    setResults,
    setSearching,
    allBlocks,
    blockMap,
    projects,
  ]);
}
