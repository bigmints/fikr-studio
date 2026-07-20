import React from "react";
import { useModKey } from "@/lib/utils";

interface EmptyWorkspaceProps {
  title?: string;
}

export function EmptyWorkspace({ title }: EmptyWorkspaceProps) {
  const mod = useModKey();

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-background z-0">
      <div className="flex flex-col items-center text-center max-w-xl px-6">
        <div className="mb-6">
          <img
            src="./logo.svg"
            alt="Fikr Studio"
            className="h-14 w-14 object-contain"
          />
        </div>
        <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-8 shadow-sm">
          <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-[pulse_3s_ease-in-out_infinite]"></span>
          Local-First Spatial Thinking
        </div>

        <div className="flex flex-col gap-3 mb-6">
          <h1 className="text-foreground text-[clamp(1.5rem,3vw,2.25rem)] font-bold tracking-tight leading-[1.2]">
            "If you think you know something, but don't write it down, you
            only think you know it."
          </h1>
          <a
            href="https://www.lamport.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm text-muted-foreground/50 hover:text-foreground/80 transition-colors pointer-events-auto"
          >
            — Leslie Lamport
          </a>
        </div>

        <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-12 max-w-md mx-auto">
          Capture and organize notes across list, masonry, and graph views.
          Configure AI only when you want classification and synthesis.
        </p>
      </div>
    </div>
  );
}
