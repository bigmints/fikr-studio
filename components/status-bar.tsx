"use client";

import { useEffect, useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { TextBlock } from "@/components/tile-card";
import { AboutPanel } from "@/components/about-panel";

import {
  Menu,
  LayoutList,
  Sparkles,
  CircleHelp,
  FolderInput,
} from "lucide-react";

interface StatusBarProps {
  blockCount: number;
  blocks: TextBlock[];
  activeProjectName: string;
  isSidebarOpen: boolean;
  isIndexOpen: boolean;
  isGhostPanelOpen: boolean;
  ghostNoteCount: number;
  onMenuClick: () => void;
  onIndexToggle: () => void;
  onGhostPanelToggle: () => void;
  onImport?: () => void;
  modelLabel?: string;
  showHelpTooltip?: boolean;
  onHelpTooltipDismiss?: () => void;
}

export function StatusBar({
  blockCount,
  blocks,
  activeProjectName,
  isSidebarOpen,
  isIndexOpen,
  isGhostPanelOpen,
  ghostNoteCount,
  onMenuClick,
  onIndexToggle,
  onGhostPanelToggle,
  onImport,
  modelLabel,
  showHelpTooltip,
  onHelpTooltipDismiss,
}: StatusBarProps) {
  const [time, setTime] = useState("");
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  // Computed but not rendered — kept for future use or side effects
  const activity = useMemo(() => {
    return {
      enriching: blocks.filter((b) => b.isEnriching).length,
      errors: blocks.filter((b) => b.isError).length,
    };
  }, [blocks]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    blocks.forEach((b) => {
      counts[b.contentType] = (counts[b.contentType] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [blocks]);

  useEffect(() => {
    const update = () =>
      setTime(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header
      className={`flex h-10 items-center justify-between bg-background/80 backdrop-blur-xl pr-4 z-50 select-none ${!isSidebarOpen ? "pl-24" : "pl-3"}`}
      style={{ WebkitAppRegion: "drag" } as any}
    >
      {/* Left: Menu + Brand + Project */}
      <div className="flex items-center gap-2">
        <button
          onClick={onMenuClick}
          style={{ WebkitAppRegion: "no-drag" } as any}
          className={`p-1.5 rounded-md transition-all duration-200 ${
            isSidebarOpen
              ? "bg-primary/10 text-primary"
              : "hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
          }`}
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <img
            src="logo-icon.png"
            alt="FikrPad"
            className="h-5 w-5 object-contain"
          />
          {activeProjectName && (
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground/40 text-[10px]">·</span>
              <span className="text-[11px] font-medium text-foreground">
                {activeProjectName}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        {/* Time */}
        <span
          className="text-[11px] font-medium text-muted-foreground tabular-nums pr-1"
          suppressHydrationWarning
        >
          {time}
        </span>

        {/* Import */}
        {onImport && (
          <button
            onClick={onImport}
            style={{ WebkitAppRegion: "no-drag" } as any}
            className="p-1.5 rounded-md transition-all duration-200 hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
            title="Import .nodepad"
          >
            <FolderInput className="h-4 w-4" />
          </button>
        )}

        {/* Synthesis */}
        <button
          onClick={onGhostPanelToggle}
          style={{ WebkitAppRegion: "no-drag" } as any}
          className={`relative p-1.5 rounded-md transition-all duration-200 ${
            isGhostPanelOpen
              ? "bg-primary/10 text-primary"
              : "hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
          }`}
          title="Synthesis Panel"
        >
          <Sparkles className="h-4 w-4" />
          {ghostNoteCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-1.25 h-1.25 rounded-full bg-primary" />
          )}
        </button>

        {/* Index */}
        <button
          onClick={onIndexToggle}
          style={{ WebkitAppRegion: "no-drag" } as any}
          className={`p-1.5 rounded-md transition-all duration-200 ${
            isIndexOpen
              ? "bg-primary/10 text-primary"
              : "hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
          }`}
          title="Workspace Index"
        >
          <LayoutList className="h-4 w-4" />
        </button>

        {/* About / Help */}
        <div className="relative">
          <button
            onClick={() => {
              setIsAboutOpen(true);
              onHelpTooltipDismiss?.();
            }}
            style={{ WebkitAppRegion: "no-drag" } as any}
            className="p-1.5 rounded-md transition-all duration-200 hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
            title="About FikrPad"
          >
            <CircleHelp className="h-4 w-4" />
          </button>

          {/* Help tooltip */}
          <AnimatePresence>
            {showHelpTooltip && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.96 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="absolute right-0 top-full mt-2.5 z-300 w-52 rounded-lg bg-foreground text-background shadow-lg pointer-events-none select-none"
              >
                <div className="px-4 py-3">
                  <p className="text-[12px] font-medium leading-snug">
                    Find help &amp; the intro video here anytime
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AboutPanel open={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </header>
  );
}
