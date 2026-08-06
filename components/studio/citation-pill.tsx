"use client";

import { useState } from "react";
import type { Citation } from "@/lib/generate/types";

interface Props {
  index: number;
  citation: Citation;
  onHighlight?: (noteId: string) => void;
}

export function CitationPill({ index, citation, onHighlight }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-block align-baseline">
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => onHighlight?.(citation.noteId)}
        className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-foreground/[0.08] text-foreground hover:bg-foreground/[0.14] transition-colors cursor-pointer mx-0.5"
      >
        #{index}
      </button>
      {open && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2 rounded-lg bg-popover border border-border/50 shadow-lg text-[11px] text-popover-foreground leading-snug z-50 pointer-events-none">
          {citation.notePreview || "Source note"}
        </span>
      )}
    </span>
  );
}
