"use client";

import * as React from "react";
import { Kbd } from "@/components/ui/kbd";
import { analytics } from "@/lib/analytics";

interface VimInputProps {
  onSubmit: (text: string) => void;
}

export function VimInput({ onSubmit }: VimInputProps) {
  const [value, setValue] = React.useState("");
  const mainInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="w-full relative z-40 flex flex-col items-center">
      {/* ── Main Input Bar ─────────────────────────────────────────────── */}
      <div className="w-full border-t border-border/30 bg-background/90 backdrop-blur-3xl px-6 py-4 flex items-center gap-4 transition-colors duration-200 focus-within:border-primary/30">
        <div className="flex items-center gap-3 flex-1">
          <div className="font-mono text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] select-none">
            Entry
          </div>
          <input
            ref={mainInputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim()) {
                analytics.track("vim_command");
                onSubmit(value.trim());
                setValue("");
              }
            }}
            placeholder="Capture something..."
            className="flex-1 bg-transparent font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
            autoFocus
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Kbd className="h-5 text-[9px] bg-secondary/50 border-border/40">
              <span className="text-[11px] mr-0.5">⌘</span>Z
            </Kbd>
            <span className="text-[9px] font-mono font-bold text-muted-foreground/80 uppercase tracking-tighter hidden sm:block">
              Undo
            </span>
          </div>

          <div className="h-4 w-px bg-border/40 hidden sm:block" />

          <div className="flex items-center gap-2">
            <Kbd className="h-5 text-[9px] bg-secondary/50 border-border/40">
              <span className="text-[11px] mr-0.5">⌘</span>K
            </Kbd>
            <span className="text-[9px] font-mono font-bold text-muted-foreground/80 uppercase tracking-tighter hidden sm:block">
              Search
            </span>
          </div>

          <div className="h-4 w-px bg-border/40" />

          <button
            onClick={() => {
              if (value.trim()) {
                analytics.track("vim_command");
                onSubmit(value.trim());
                setValue("");
              }
            }}
            className="font-mono text-[10px] font-bold text-primary uppercase tracking-widest hover:text-primary/80 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            disabled={!value.trim()}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
