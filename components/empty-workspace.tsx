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
        <div className="mb-6 opacity-80 mix-blend-plus-lighter">
          <img
            src="./logo-icon.png"
            alt="Fikr Studio"
            className="h-14 w-14 object-contain"
          />
        </div>
        <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-8 shadow-sm">
          <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-[pulse_3s_ease-in-out_infinite]"></span>
          AI-Powered Spatial Thinking
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
          Fikr Studio transforms your thinking into an organised, spatial
          workspace. Write freely, and let the AI categorise, connect, and
          synthesise.
        </p>

        <div className="flex flex-col items-center gap-3">
          <p className="text-[12px] text-foreground/70 uppercase tracking-[0.15em] whitespace-nowrap font-mono bg-secondary/50 px-5 py-2.5 rounded-lg border border-border/80 shadow-sm">
            {`type anything · #type to classify · ${mod}K commands`}
          </p>
        </div>
      </div>
    </div>
  );
}
