"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Citation, HeatAnnotation } from "@/lib/generate/types";

interface Props {
  markdown: string;
  citations: Citation[];
  heatAnnotations: HeatAnnotation[];
  isStreaming: boolean;
  showSources: boolean;
  onHighlightNote?: (noteId: string) => void;
}

const HEAT_BG: Record<string, string> = {
  hot:     "rgba(255,107,107,0.22)",
  cold:    "rgba(78,205,196,0.22)",
  neutral: "rgba(255,193,7,0.22)",
};

/** Apply heatmap highlights by replacing matching text with <mark> spans. */
function applyHeatHighlights(text: string, annotations: HeatAnnotation[]): string {
  let out = text;
  for (const ann of annotations) {
    const escaped = ann.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const bg = HEAT_BG[ann.color] ?? "transparent";
    out = out.replace(
      new RegExp(escaped, "g"),
      `<mark style="background:${bg};border-radius:3px;padding:0 2px">${ann.text}</mark>`,
    );
  }
  return out;
}

/** Strip any accidental JSON/preamble artefacts the model sometimes prepends. */
function cleanMarkdown(raw: string): string {
  // Remove leading { ": " ... } JSON-like artifacts
  return raw.replace(/^\s*\{[^{]*?\}\s*/m, "").trim();
}

export function GeneratePanel({
  markdown, heatAnnotations, isStreaming, onHighlightNote,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom while streaming
  useEffect(() => {
    if (isStreaming && markdown) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [markdown, isStreaming]);

  const displayText = applyHeatHighlights(cleanMarkdown(markdown), heatAnnotations);

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      {markdown ? (
        <div className="max-w-2xl mx-auto px-10 pt-8 pb-16">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Headings
              h1: ({ children }) => (
                <h1 className="text-2xl font-bold text-foreground mt-8 mb-4 leading-tight">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-lg font-semibold text-foreground mt-6 mb-3 leading-snug">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-base font-semibold text-foreground/90 mt-4 mb-2">
                  {children}
                </h3>
              ),
              // Body
              p: ({ children }) => (
                <p className="text-sm text-foreground/85 leading-relaxed mb-4">
                  {children}
                </p>
              ),
              // Lists
              ul: ({ children }) => (
                <ul className="list-disc list-outside pl-5 mb-4 space-y-1.5 text-sm text-foreground/85 leading-relaxed">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-outside pl-5 mb-4 space-y-1.5 text-sm text-foreground/85 leading-relaxed">
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="pl-1">{children}</li>
              ),
              // Inline
              strong: ({ children }) => (
                <strong className="font-semibold text-foreground">{children}</strong>
              ),
              em: ({ children }) => (
                <em className="italic text-foreground/80">{children}</em>
              ),
              code: ({ children, className }) => {
                const isBlock = !!className;
                return isBlock ? (
                  <code className="block bg-card border border-border/40 rounded-lg px-4 py-3 text-xs font-mono text-foreground/80 mb-4 overflow-x-auto whitespace-pre">
                    {children}
                  </code>
                ) : (
                  <code className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs font-mono">
                    {children}
                  </code>
                );
              },
              // Blockquote
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-primary/50 pl-4 my-4 text-muted-foreground italic text-sm leading-relaxed">
                  {children}
                </blockquote>
              ),
              // Horizontal rule
              hr: () => (
                <hr className="border-border/30 my-6" />
              ),
              // Marks from heatmap (passed via dangerouslySetInnerHTML in p)
              mark: ({ children }) => (
                <mark className="rounded px-0.5">{children}</mark>
              ),
            }}
          >
            {displayText}
          </ReactMarkdown>

          {/* Blinking cursor while streaming */}
          {isStreaming && (
            <span className="inline-block w-0.5 h-[1em] bg-primary/70 animate-pulse ml-0.5 align-middle rounded-full" />
          )}
        </div>
      ) : isStreaming ? (
        /* Loading skeleton while waiting for first chunk */
        <div className="max-w-2xl mx-auto px-10 pt-10 flex flex-col gap-4 animate-pulse">
          <div className="h-6 w-2/3 bg-border/40 rounded-lg" />
          <div className="h-4 w-full bg-border/30 rounded" />
          <div className="h-4 w-5/6 bg-border/30 rounded" />
          <div className="h-4 w-full bg-border/30 rounded" />
          <div className="h-4 w-4/5 bg-border/30 rounded mt-2" />
          <div className="h-4 w-full bg-border/30 rounded" />
          <div className="h-4 w-3/4 bg-border/30 rounded" />
        </div>
      ) : null}

      <div ref={bottomRef} />
    </div>
  );
}
