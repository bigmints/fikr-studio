"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles,
  Search,
  AlignJustify,
  FolderInput,
  Network,
  Download,
  Clipboard,
  MoreHorizontal,
  RefreshCw,
  FolderDown,
  Zap,
  TrendingUp,
  Keyboard,
} from "lucide-react";

export interface WordUsage {
  wordsUsed: number;
  wordsLimit: number;
  percentUsed: number;
  plan: string;
}

interface StatusBarProps {
  activeProjectName: string;
  isGhostPanelOpen: boolean;
  ghostNoteCount: number;
  viewMode: "tiling" | "list" | "graph";
  onGhostPanelToggle: () => void;
  onViewModeChange: (mode: "tiling" | "list" | "graph") => void;
  onSearchClick?: () => void;
  onImport: () => void;
  onExportFikrdata: () => void;
  onOpenSettings: () => void;
  onOpenKeyboardShortcuts?: () => void;
  modelLabel?: string;
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  enrichingCount?: number;
  /** Live usage data — shown for Plus/Pro users only */
  wordUsage?: WordUsage | null;
  /** Called when the word-count pill is clicked */
  onWordCountClick?: () => void;
  /** Called to trigger the onboarding flow in dev mode */
  onTriggerOnboarding?: () => void;
}

function fmtWords(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return n.toString();
}

export function StatusBar({
  activeProjectName,
  isGhostPanelOpen,
  ghostNoteCount,
  viewMode,
  onGhostPanelToggle,
  onViewModeChange,
  onSearchClick,
  onImport,
  onExportFikrdata,
  onOpenSettings,
  onOpenKeyboardShortcuts,
  modelLabel,
  isMenuOpen,
  setIsMenuOpen,
  enrichingCount = 0,
  wordUsage,
  onWordCountClick,
}: StatusBarProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pillHovered, setPillHovered] = useState(false);

  // Close system menu on outside click
  useEffect(() => {
    if (!isMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isMenuOpen, setIsMenuOpen]);

  const menuItem = (
    icon: React.ReactNode,
    label: string,
    onClick: () => void,
    destructive = false,
    shortcut?: string,
  ) => (
    <button
      onClick={() => {
        onClick();
        setIsMenuOpen(false);
      }}
      className={`flex min-h-9 w-full items-center gap-2.5 rounded-md px-3 text-left text-[13px] transition-colors hover:bg-foreground/[0.07] ${
        destructive
          ? "text-red-400 hover:text-red-300"
          : "text-foreground/80 hover:text-foreground"
      }`}
    >
      <span className="opacity-60">{icon}</span>
      {label}
      {shortcut && <span className="ml-auto font-mono text-[11px] text-muted-foreground">{shortcut}</span>}
    </button>
  );

  // ── Word count pill ──────────────────────────────────────────────────────
  const showUsage = !!wordUsage;

  const isUnlimited = showUsage && wordUsage!.wordsLimit === -1;

  const pct = showUsage && wordUsage!.wordsLimit > 0
    ? Math.min(1, wordUsage!.wordsUsed / wordUsage!.wordsLimit)
    : 0;

  const isNear = showUsage && !isUnlimited && wordUsage!.percentUsed >= 80 && wordUsage!.percentUsed < 100;
  const isAtLimit = showUsage && !isUnlimited && wordUsage!.percentUsed >= 100;

  const pillColor = isAtLimit
    ? { bar: "#EF4444", text: "text-red-400", border: "border-red-500/30", bg: "bg-red-500/10" }
    : isNear
    ? { bar: "#F59E0B", text: "text-amber-400", border: "border-amber-500/30", bg: "bg-amber-500/10" }
    : { bar: "#3CA6A6", text: "text-[#3CA6A6]", border: "border-[#3CA6A6]/25", bg: "bg-[#3CA6A6]/10" };

  return (
    <header
      className="studio-toolbar"
      style={{ WebkitAppRegion: "drag" } as any}
    >
      {/* ── Left: Menu + Brand + Space name ── */}
      <div className="studio-toolbar__left">
        {activeProjectName && (
          <div className="flex items-center">
            <span className="max-w-[180px] truncate text-[13px] font-medium text-foreground">
              {activeProjectName}
            </span>
          </div>
        )}
      </div>

      <div className="studio-toolbar__center">
        {onSearchClick && (
          <button
            onClick={onSearchClick}
            style={{ WebkitAppRegion: "no-drag" } as any}
            className="group flex h-8 max-w-sm flex-1 items-center gap-2 rounded-md bg-secondary/55 px-3 text-muted-foreground/65 transition-colors duration-200 hover:bg-secondary/80 hover:text-foreground"
            title="Search workspace (⌘F)"
          >
            <Search className="h-3 w-3 shrink-0" />
            <span className="flex-1 truncate text-left text-[13px] font-medium">
              Search workspace...
            </span>
            <span className="shrink-0 font-mono text-xs opacity-50 transition-opacity group-hover:opacity-70">
              ⌘F
            </span>
          </button>
        )}
      </div>

      {/* ── Right: View toggle + workspace icons + system menu ── */}
      <div
        className="studio-toolbar__right"
        style={{ WebkitAppRegion: "no-drag" } as any}
      >
        {/* ── Word Count Pill — always visible for paid users ── */}
        {showUsage && (
          <button
            onClick={onWordCountClick}
            onMouseEnter={() => setPillHovered(true)}
            onMouseLeave={() => setPillHovered(false)}
            className={`relative flex items-center gap-1.5 h-7 px-2.5 rounded-md border transition-all duration-200 group ${pillColor.border} ${pillColor.bg} hover:opacity-90`}
            title={isUnlimited ? `${fmtWords(wordUsage!.wordsUsed)} words used (BYOK)` : `${fmtWords(wordUsage!.wordsUsed)} / ${fmtWords(wordUsage!.wordsLimit)} words used — click to manage`}
            style={{ WebkitAppRegion: "no-drag" } as any}
          >
            {/* Icon */}
            {isAtLimit ? (
              <TrendingUp className={`h-3 w-3 shrink-0 ${pillColor.text}`} />
            ) : (
              <Zap className={`h-3 w-3 shrink-0 ${pillColor.text} ${isNear ? "animate-pulse" : ""}`} />
            )}

            {/* Text */}
            <span className={`text-[11px] font-semibold font-mono ${pillColor.text} whitespace-nowrap`}>
              {isAtLimit && !pillHovered
                ? "Limit reached"
                : isUnlimited
                ? `${fmtWords(wordUsage!.wordsUsed)} words`
                : `${fmtWords(wordUsage!.wordsUsed)} / ${fmtWords(wordUsage!.wordsLimit)}`}
            </span>

            {/* Mini arc progress bar */}
            <div className="w-14 h-1 rounded-full bg-current opacity-10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(pct * 100).toFixed(1)}%`, background: pillColor.bar }}
              />
            </div>

            {/* Hover overlay — "Top up →" or "Billing →" */}
            <AnimatePresence>
              {pillHovered && (
                <motion.span
                  initial={{ opacity: 0, x: 4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 4 }}
                  transition={{ duration: 0.1 }}
                  className={`text-[11px] font-semibold ml-0.5 ${pillColor.text}`}
                >
                  {isAtLimit ? "Top up →" : "Billing →"}
                </motion.span>
              )}
            </AnimatePresence>

            {/* Near-limit pulsing dot */}
            {(isNear || isAtLimit) && (
              <span
                className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: pillColor.bar }}
              />
            )}
          </button>
        )}

        {/* List / Graph pill */}
        <div className="flex items-center rounded-md border border-border/30 bg-secondary/30 p-0.5 gap-0.5">
          <button
            onClick={() => onViewModeChange("list")}
            className={`flex items-center justify-center p-1.5 rounded-sm transition-all duration-150 ${
              viewMode === "list"
                ? "bg-foreground/[0.08] text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
            title="List view"
          >
            <AlignJustify className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onViewModeChange("graph")}
            className={`flex items-center justify-center p-1.5 rounded-sm transition-all duration-150 ${
              viewMode === "graph"
                ? "bg-foreground/[0.08] text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
            title="Graph view"
          >
            <Network className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Global Enrichment Queue Indicator */}
        {enrichingCount > 0 && (
          <div className="flex items-center rounded-md border border-border/30 bg-secondary/30 px-2.5 py-1 gap-2 mr-1">
            <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground/60" />
            <span className="text-[11px] font-medium text-muted-foreground/70">
              AI is processing {enrichingCount} note{enrichingCount > 1 ? "s" : ""}...
            </span>
          </div>
        )}

        {/* Insights panel button */}
        <div className="flex items-center rounded-md bg-secondary/45 p-0.5">
          <button
            onClick={onGhostPanelToggle}
            className={`relative flex min-h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium transition-colors duration-150 ${
              isGhostPanelOpen
                ? "bg-foreground/[0.08] text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Insights Panel"
          >
            <Sparkles className="h-3 w-3" />
            <span className="hidden sm:block">Insights</span>
            {ghostNoteCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-primary" />
            )}
          </button>
        </div>

        {/* System menu ··· */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen((v) => !v)}
            className={`p-1.5 rounded-md transition-all duration-200 ${
              isMenuOpen
                ? "bg-secondary/80 text-foreground"
                : "hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
            }`}
            title="More options"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.96 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute right-0 top-full z-[300] mt-2 w-56 overflow-hidden rounded-lg border border-border/60 bg-popover p-1.5 shadow-xl"
              >
                <div>

                  {/* Import / Export */}
                  {menuItem(
                    <FolderInput className="h-3.5 w-3.5" />,
                    "Import .fikrdata",
                    onImport,
                  )}
                  {menuItem(
                    <FolderDown className="h-3.5 w-3.5" />,
                    "Export as .fikrdata",
                    onExportFikrdata,
                  )}
                  {onOpenKeyboardShortcuts && menuItem(
                    <Keyboard className="h-3.5 w-3.5" />,
                    "Keyboard shortcuts",
                    onOpenKeyboardShortcuts,
                    false,
                    "⌘/",
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

    </header>
  );
}
