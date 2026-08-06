"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import { useModKey } from "@/lib/utils";

interface AboutPanelProps {
  open: boolean;
  onClose: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[12px] font-semibold text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Shortcut({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        {keys.map((key) => (
          <kbd key={key} className="rounded-sm border border-border bg-secondary px-1.5 py-0.5 font-mono text-[11px]">
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
}

export function AboutPanel({ open, onClose }: AboutPanelProps) {
  const mod = useModKey();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-6 backdrop-blur-sm"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <div className="flex max-h-[86vh] w-full max-w-[620px] flex-col overflow-hidden rounded-[10px] border border-border/70 bg-background shadow-2xl">
            <div className="flex h-11 shrink-0 items-center justify-end px-4" style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
              <button
                onClick={onClose}
                aria-label="Close About"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto custom-scrollbar">
            <div className="space-y-9 px-10 pb-10">
              <header className="space-y-4">
                <div className="flex items-center gap-3">
                  <img src="./logo-icon.png" alt="" className="h-6 w-6 object-contain" />
                  <h1 className="font-serif text-[32px] font-medium leading-tight">Fikr Studio</h1>
                </div>
                <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                  A macOS workspace for capturing notes, organizing ideas, and optionally enriching them with AI.
                </p>
              </header>

              <Section title="What works">
                <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                  <li>Capture and organize notes without an account.</li>
                  <li>Browse the same workspace in list and graph views.</li>
                  <li>Import and export projects using the versioned <code>.fikrdata</code> format.</li>
                  <li>Use OpenRouter, OpenAI, or Google Gemini for optional BYOK enrichment.</li>
                  <li>Use authenticated cloud sync with a Plus or Pro account.</li>
                  <li>Connect local MCP clients while Fikr Studio is running.</li>
                </ul>
              </Section>

              <Section title="Your data">
                <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                  <p>
                    The desktop workspace is cached in <code>~/.fikr-studio/workspace.json</code>. Local note capture does not require an account.
                  </p>
                  <p>
                    When you use BYOK enrichment, selected note context is sent to the AI provider you configured. When Plus or Pro cloud sync is enabled, workspace data is sent to authenticated Fikr cloud APIs.
                  </p>
                  <p>Fikr Studio does not load third-party analytics in the desktop renderer.</p>
                </div>
              </Section>

              <Section title="Keyboard shortcuts">
                <div>
                  <Shortcut keys={[mod, "Shift", "M"]} label="New entry" />
                  <Shortcut keys={[mod, "F"]} label="Search workspace" />
                  <Shortcut keys={[mod, "/"]} label="All keyboard shortcuts" />
                  <Shortcut keys={[mod, "Z"]} label="Undo" />
                  <Shortcut keys={["Esc"]} label="Close the active panel" />
                </div>
              </Section>

              <Section title="Attribution">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Fikr Studio is based on Nodepad by Saleh Kayyali and is distributed under the MIT License.
                </p>
              </Section>
            </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
