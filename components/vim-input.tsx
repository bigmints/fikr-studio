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
      <div className="w-full border-t border-border/40 bg-background/80 backdrop-blur-3xl px-6 py-5 flex items-center gap-4 transition-all duration-300 focus-within:border-primary/40 relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-primary/20 to-transparent" />

        <div className="flex items-center gap-3 flex-1">
          <div className="font-mono text-[10px] font-bold text-foreground/50 uppercase tracking-[0.2em] select-none">
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
            className="flex-1 bg-transparent font-mono text-sm tracking-tight text-foreground outline-none placeholder:text-muted-foreground/60"
            autoFocus
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Kbd className="h-5 text-[9px]">
              <span className="text-[11px] mr-0.5">⌘</span>Z
            </Kbd>
            <span className="text-[9px] font-mono font-bold text-foreground/50 uppercase tracking-tighter">
              Undo
            </span>
          </div>

          <div className="h-4 w-px bg-foreground/10" />

          <div className="flex items-center gap-2">
            <Kbd className="h-5 text-[9px]">
              <span className="text-[11px] mr-0.5">⌘</span>F
            </Kbd>
            <span className="text-[9px] font-mono font-bold text-foreground/50 uppercase tracking-tighter">
              Search
            </span>
          </div>

          <div className="h-4 w-px bg-foreground/15" />

          <button
            onClick={() => {
              if (value.trim()) {
                analytics.track("vim_command");
                onSubmit(value.trim());
                setValue("");
              }
            }}
            className="font-mono text-[10px] font-bold text-primary uppercase tracking-widest hover:brightness-125 transition-all active:scale-95 disabled:opacity-20"
            disabled={!value.trim()}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
