"use client";

import type { HeatAnnotation, HeatColor } from "@/lib/generate/types";

const HEAT_OPTIONS: { color: HeatColor; hex: string; label: string }[] = [
  { color: "hot",     hex: "#FF6B6B", label: "Expand"   },
  { color: "cold",    hex: "#4ECDC4", label: "Trim"     },
  { color: "neutral", hex: "#F0A500", label: "Rephrase" },
];

interface Props {
  activeColor: HeatColor | null;
  onSetColor: (c: HeatColor | null) => void;
  onAnnotate: (annotation: HeatAnnotation) => void;
  isRefining: boolean;
}

export function HeatmapToolbar({ activeColor, onSetColor, isRefining }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      {HEAT_OPTIONS.map(({ color, hex, label }) => (
        <button
          key={color}
          onClick={() => onSetColor(activeColor === color ? null : color)}
          style={{
            borderColor: activeColor === color ? hex : "transparent",
            color:       activeColor === color ? hex : undefined,
          }}
          className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all text-left ${
            activeColor === color
              ? "bg-card shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-card/60"
          }`}
        >
          {/* Dot indicator */}
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: hex }}
          />
          {label}
          {isRefining && activeColor === color && (
            <span className="ml-auto text-xs animate-pulse">Refining…</span>
          )}
        </button>
      ))}
      {activeColor && (
        <button
          onClick={() => onSetColor(null)}
          className="text-xs text-muted-foreground/60 hover:text-muted-foreground text-center mt-0.5 transition-colors"
        >
          Clear selection
        </button>
      )}
    </div>
  );
}
