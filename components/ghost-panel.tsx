"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus, Sparkles, X, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownComponents } from "./markdown-components";
import { analytics } from "@/lib/analytics";

export interface GhostNote {
  id: string;
  text: string;
  category: string;
  isGenerating: boolean;
  isError?: boolean;
  statusText?: string;
}

interface GhostPanelProps {
  ghostNotes: GhostNote[];
  isOpen: boolean;
  onClose: () => void;
  onClaim: (id: string) => void;
  onDismiss: (id: string) => void;
  onRetry: (id: string) => void;
}

const panelTransition = { duration: 0.25, ease: [0.25, 0.1, 0.25, 1.0] };

export function GhostPanel({
  ghostNotes,
  isOpen,
  onClose,
  onClaim,
  onDismiss,
  onRetry,
}: GhostPanelProps) {
  return (
    <motion.div
      data-open={isOpen}
      aria-hidden={!isOpen}
      inert={!isOpen}
      style={{
        width: isOpen ? 320 : 0,
      }}
      animate={{
        opacity: isOpen ? 1 : 0,
        width: isOpen ? 320 : 0,
      }}
      transition={panelTransition}
      className="fikr-ghost-panel relative z-50 flex h-full shrink-0 flex-col overflow-hidden bg-background"
    >
      <div className="fikr-ghost-panel__content flex h-full w-[320px] flex-col">
        {/* Header */}
        <div className="flex h-11 items-center justify-between border-b-0 px-4 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground/90 select-none">
              Insights
            </h3>
            {ghostNotes.length > 0 && (
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {ghostNotes.length}
              </span>
            )}
          </div>
          <button
            type="button"
            aria-label="Close insights"
            onClick={() => {
              analytics.track("ghost_panel_close");
              onClose();
            }}
            className="p-1.5 hover:bg-foreground/5 rounded-md transition-colors text-muted-foreground/40 hover:text-foreground/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Note list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-2">
          {ghostNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <Sparkles className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground/60 leading-relaxed text-center">
                Emergent insights will appear here
                <br />
                as you write
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {ghostNotes.map((note) => (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 16, scale: 0.98 }}
                  transition={panelTransition}
                  className="flex flex-col gap-3 border-b border-border/50 py-4"
                >
                  {/* Row: sparkles + category + dismiss */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                      {note.category && !note.isGenerating && (
                        <span className="text-xs font-medium text-muted-foreground/70">
                          {note.category}
                        </span>
                      )}
                    </div>
                    {!note.isGenerating && (
                      <button
                        type="button"
                        aria-label={`Dismiss ${note.category || "insight"}`}
                        onClick={() => onDismiss(note.id)}
                        className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-foreground/5 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Text / loading */}
                  {note.isGenerating ? (
                    <div className="flex items-center gap-3 py-1">
                      <div className="h-3 w-16 rounded-md bg-muted animate-pulse shrink-0" />
                      <p className="text-xs text-muted-foreground/70">
                        Generating insight...
                      </p>
                    </div>
                  ) : note.isError ? (
                    <div className="flex flex-col gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                      <p className="text-xs text-red-500 dark:text-red-400 font-medium leading-relaxed">
                        {note.statusText || "Generation failed"}
                      </p>
                    </div>
                  ) : (
                    <div className="max-w-none text-sm font-normal leading-relaxed text-foreground/85 markdown-body">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={MarkdownComponents as any}
                      >
                        {note.text}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* Add button / Retry button */}
                  {!note.isGenerating &&
                    (note.isError ? (
                      <button
                        type="button"
                        onClick={() => onRetry(note.id)}
                        className="flex min-h-9 items-center gap-1.5 w-full justify-center rounded-md bg-red-500/10 hover:bg-red-500/20 px-4 text-xs font-semibold text-red-600 dark:text-red-400 transition-colors"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Retry synthesis
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onClaim(note.id)}
                        className="flex min-h-9 items-center gap-1.5 w-full justify-center rounded-md bg-foreground text-background px-4 text-xs font-semibold transition-opacity hover:opacity-85"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add to notes
                      </button>
                    ))}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Footer */}
        <div className="border-t-0 px-3 py-2.5 shrink-0">
          <p className="text-xs text-muted-foreground/50 text-center">
            Generated from enriched notes
          </p>
        </div>
      </div>
    </motion.div>
  );
}
