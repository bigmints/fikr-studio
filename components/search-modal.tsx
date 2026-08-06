"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X } from "lucide-react";
import { SearchPanel } from "@/components/search-panel";
import { useSearch } from "@/lib/search-store";
import { Kbd } from "@/components/ui/kbd";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Array<{ id: string; name: string; blocks: any[] }>;
  onSelectResult: (blockId: string, projectId: string) => void;
}

export function SearchModal({
  isOpen,
  onClose,
  projects,
  onSelectResult,
}: SearchModalProps) {
  const { setQuery, state, selectNext, selectPrev, addRecentSearch, clearRecentSearches } = useSearch();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [query, setLocalQuery] = React.useState("");

  const results = state.results;
  const selectedIndex = state.selectedIndex;

  // Focus input when opened, clear on close
  React.useEffect(() => {
    if (isOpen) {
      setLocalQuery("");
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen, setQuery]);

  // Close on Escape
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectNext();
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        selectPrev();
      }
      if (e.key === "Enter") {
        const selected = results[selectedIndex];
        if (selected) {
          if (query.trim().length >= 2) {
            addRecentSearch(query.trim());
          }
          onSelectResult(selected.blockId, selected.projectId);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose, selectNext, selectPrev, results, selectedIndex, onSelectResult, addRecentSearch, query]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalQuery(e.target.value);
    setQuery(e.target.value);
  };

  const handleSelect = (blockId: string, projectId: string) => {
    if (query.trim().length >= 2) {
      addRecentSearch(query.trim());
    }
    onSelectResult(blockId, projectId);
    onClose();
  };

  // Click backdrop to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full max-w-xl overflow-hidden rounded-lg border border-border/60 bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Input */}
            <div className="flex items-center gap-3 px-4 h-13 border-b border-border/40">
              <Search className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={handleChange}
                placeholder="Search your notes..."
                className="flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/50 py-3.5"
              />
              <div className="flex items-center gap-2 shrink-0">
                <Kbd className="text-[11px]">Esc</Kbd>
                <button
                  onClick={onClose}
                  className="p-1 rounded hover:bg-secondary/60 text-muted-foreground/50 hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Recent Searches */}
            {query.length < 2 && state.recentSearches.length > 0 && (
              <div className="max-h-60 overflow-y-auto scrollbar-none py-2">
                <div className="px-4 py-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                    Recent Searches
                  </span>
                  <button 
                    onClick={() => clearRecentSearches()}
                    className="text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors"
                  >
                    Clear
                  </button>
                </div>
                {state.recentSearches.map((recentQuery, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setLocalQuery(recentQuery);
                      setQuery(recentQuery);
                      requestAnimationFrame(() => inputRef.current?.focus());
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-secondary/40 text-foreground transition-colors"
                  >
                    <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                    <span className="text-[13px]">{recentQuery}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Results */}
            <SearchPanel
              projects={projects}
              blocks={projects.flatMap((p) => p.blocks)}
              onSelectResult={handleSelect}
              listClassName="max-h-[60vh]"
            />

            {/* Footer */}
            {state.results.length > 0 && (
              <div className="flex items-center gap-3 border-t border-border/30 px-4 py-2 bg-secondary/10">
                <div className="flex items-center gap-1.5">
                  <Kbd className="text-[11px]">↑↓</Kbd>
                  <span className="text-[11px] text-muted-foreground/60">navigate</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Kbd className="text-[11px]">↵</Kbd>
                  <span className="text-[11px] text-muted-foreground/60">open</span>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <Kbd className="text-[11px]">esc</Kbd>
                  <span className="text-[11px] text-muted-foreground/60">close</span>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
