"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus, Sparkles, X } from "lucide-react";

export interface GhostNote {
  id: string;
  text: string;
  category: string;
  isGenerating: boolean;
}

interface GhostPanelProps {
  ghostNotes: GhostNote[];
  isOpen: boolean;
  onClose: () => void;
  onClaim: (id: string) => void;
  onDismiss: (id: string) => void;
}

const panelTransition = { duration: 0.25, ease: [0.25, 0.1, 0.25, 1.0] };

export function GhostPanel({
  ghostNotes,
  isOpen,
  onClose,
  onClaim,
  onDismiss,
}: GhostPanelProps) {
  return (
    <motion.div
      style={{
        width: isOpen ? 320 : 0,
      }}
      animate={{
        opacity: isOpen ? 1 : 0,
        width: isOpen ? 320 : 0,
      }}
      transition={panelTransition}
      className="flex flex-col h-full bg-card/60 backdrop-blur-2xl border-l-0 shrink-0 overflow-hidden relative z-50"
    >
      <div className="w-[320px] flex flex-col h-full">
        {/* Header */}
        <div className="flex h-11 items-center justify-between border-b-0 px-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-6 w-6 bg-primary/5 rounded-md">
              <Sparkles className="h-3.5 w-3.5 text-primary/70" />
            </div>
            <h3 className="text-sm font-semibold text-foreground/90 select-none">
              Insights
            </h3>
            {ghostNotes.length > 0 && (
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md text-[11px] font-semibold tabular-nums">
                {ghostNotes.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-foreground/5 rounded-md transition-colors text-muted-foreground/40 hover:text-foreground/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Note list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-4 px-4 space-y-3">
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
                  className="bg-slate-900/40 border-0 rounded-xl p-4 flex flex-col gap-3"
                >
                  {/* Row: sparkles + category + dismiss */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                      {note.category && !note.isGenerating && (
                        <span className="text-[10px] font-medium text-muted-foreground/50">
                          {note.category}
                        </span>
                      )}
                    </div>
                    {!note.isGenerating && (
                      <button
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
                      <div className="h-3 w-16 rounded-md bg-muted/50 animate-pulse shrink-0" />
                      <p className="text-xs text-muted-foreground/50">
                        Generating insight...
                      </p>
                    </div>
                  ) : (
                    <p className="text-[14px] font-normal leading-relaxed text-foreground/85">
                      {note.text}
                    </p>
                  )}

                  {/* Add button */}
                  {!note.isGenerating && (
                    <button
                      onClick={() => onClaim(note.id)}
                      className="flex items-center gap-1.5 w-full justify-center rounded-lg bg-primary/8 hover:bg-primary/12 px-4 py-2 text-xs font-medium text-primary transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add to canvas
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Footer */}
        <div className="border-t-0 px-3 py-2.5 shrink-0">
          <p className="text-[10px] text-muted-foreground/30 text-center">
            Emergent from your patterns
          </p>
        </div>
      </div>
    </motion.div>
  );
}
