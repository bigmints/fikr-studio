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
    <div className="w-full relative z-40 flex flex-col items-center pb-6 pt-2 bg-gradient-to-t from-background to-transparent">
      {/* ── Main Input Bar ─────────────────────────────────────────────── */}
      <div className="w-[800px] max-w-[95%] border border-border/60 shadow-xl rounded-2xl bg-card/95 backdrop-blur-xl px-5 py-3.5 flex items-center gap-4 transition-all duration-300 focus-within:border-primary/50 focus-within:shadow-2xl focus-within:-translate-y-0.5">
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
