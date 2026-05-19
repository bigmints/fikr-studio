"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles,
  Search,
  LayoutGrid,
  AlignJustify,
  FolderInput,
  Network,
  Download,
  Clipboard,
  MoreHorizontal,
  RefreshCw,
  FolderDown,
  Settings,
  Zap,
  TrendingUp,
} from "lucide-react";
import { LOCAL_AI_CONFIG, LM_STUDIO_MODELS } from "@/local-ai.config";

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
  modelLabel?: string;
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  enrichingCount?: number;
  /** Live usage data — shown for Plus/Pro users only */
  wordUsage?: WordUsage | null;
  /** Called when the word-count pill is clicked */
  onWordCountClick?: () => void;
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
  modelLabel,
  isMenuOpen,
  setIsMenuOpen,
  enrichingCount = 0,
  wordUsage,
  onWordCountClick,
}: StatusBarProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pillHovered, setPillHovered] = useState(false);

  // Dev Model Switcher state
  const [devModel, setDevModel] = useState<string>(LOCAL_AI_CONFIG.model);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dev_local_model");
      if (stored) setDevModel(stored);
    }
  }, []);

  const handleModelChange = (newModel: string) => {
    setDevModel(newModel);
    localStorage.setItem("dev_local_model", newModel);
  };

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
  }, [isMenuOpen]);

  const menuItem = (
    icon: React.ReactNode,
    label: string,
    onClick: () => void,
    destructive = false,
  ) => (
    <button
      onClick={() => {
        onClick();
        setIsMenuOpen(false);
      }}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] transition-colors hover:bg-foreground/5 ${
        destructive
          ? "text-red-400 hover:text-red-300"
          : "text-foreground/80 hover:text-foreground"
      }`}
    >
      <span className="opacity-60">{icon}</span>
      {label}
    </button>
  );

  // ── Word count pill ──────────────────────────────────────────────────────
  const showUsage =
    wordUsage &&
    wordUsage.wordsLimit > 0 &&
    (wordUsage.plan.toLowerCase().includes("plus") ||
      wordUsage.plan.toLowerCase().includes("pro"));

  const pct = showUsage
    ? Math.min(1, wordUsage!.wordsUsed / wordUsage!.wordsLimit)
    : 0;

  const isNear = showUsage && wordUsage!.percentUsed >= 80 && wordUsage!.percentUsed < 100;
  const isAtLimit = showUsage && wordUsage!.percentUsed >= 100;

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
        <div className="flex items-center gap-2">
          <img
            src="./logo-icon.png"
            alt="Fikr Studio"
            className="h-5 w-5 object-contain"
          />
          {activeProjectName && (
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground/40 text-[10px]">·</span>
              <span className="text-[11px] font-medium text-foreground truncate max-w-[120px]">
                {activeProjectName}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Center: Search button (Intel only) ── */}
      <div className="studio-toolbar__center">
        {onSearchClick && (
          <button
            onClick={onSearchClick}
            style={{ WebkitAppRegion: "no-drag" } as any}
            className="flex-1 max-w-xs flex items-center gap-2 h-7 px-3 rounded-md bg-secondary/40 border border-border/30 text-muted-foreground/60 hover:text-foreground hover:bg-secondary/60 hover:border-border/60 transition-all duration-200 group"
            title="Search notes (⌘F)"
          >
            <Search className="h-3 w-3 shrink-0" />
            <span className="text-[11px] font-medium flex-1 text-left truncate">
              Search notes...
            </span>
            <span className="font-mono text-[9px] opacity-50 shrink-0 group-hover:opacity-70 transition-opacity">
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
            title={`${fmtWords(wordUsage!.wordsUsed)} / ${fmtWords(wordUsage!.wordsLimit)} words used — click to manage`}
            style={{ WebkitAppRegion: "no-drag" } as any}
          >
            {/* Icon */}
            {isAtLimit ? (
              <TrendingUp className={`h-3 w-3 shrink-0 ${pillColor.text}`} />
            ) : (
              <Zap className={`h-3 w-3 shrink-0 ${pillColor.text} ${isNear ? "animate-pulse" : ""}`} />
            )}

            {/* Text */}
            <span className={`text-[10px] font-semibold font-mono ${pillColor.text} whitespace-nowrap`}>
              {isAtLimit && !pillHovered
                ? "Limit reached"
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
                  className={`text-[10px] font-semibold ml-0.5 ${pillColor.text}`}
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

        {/* List / Masonry / Graph pill */}
        <div className="flex items-center rounded-md border border-border/30 bg-secondary/30 p-0.5 gap-0.5">
          <button
            onClick={() => onViewModeChange("list")}
            className={`flex items-center justify-center p-1.5 rounded-sm transition-all duration-150 ${
              viewMode === "list"
                ? "bg-primary/15 text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
            title="List view"
          >
            <AlignJustify className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onViewModeChange("tiling")}
            className={`flex items-center justify-center p-1.5 rounded-sm transition-all duration-150 ${
              viewMode === "tiling"
                ? "bg-primary/15 text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
            title="Masonry view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onViewModeChange("graph")}
            className={`flex items-center justify-center p-1.5 rounded-sm transition-all duration-150 ${
              viewMode === "graph"
                ? "bg-primary/15 text-primary shadow-sm"
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
            <span className="text-[10px] font-medium text-muted-foreground/70">
              AI is processing {enrichingCount} note{enrichingCount > 1 ? "s" : ""}...
            </span>
          </div>
        )}

        {/* Insights panel button */}
        <div className="flex items-center rounded-md border border-border/30 bg-secondary/30 p-0.5">
          <button
            onClick={onGhostPanelToggle}
            className={`relative flex items-center gap-1.5 px-2 py-1 rounded-sm text-[10px] font-semibold transition-all duration-150 ${
              isGhostPanelOpen
                ? "bg-primary/15 text-primary shadow-sm"
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

        {/* Dev Model Switcher */}
        {process.env.NODE_ENV === "development" && LOCAL_AI_CONFIG.enabled && (
          <div className="flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 p-0.5 ml-1" style={{ WebkitAppRegion: "no-drag" } as any}>
            <select
              value={devModel}
              onChange={(e) => handleModelChange(e.target.value)}
              className="bg-transparent text-[10px] font-mono font-medium text-amber-500 outline-none px-1 py-0.5 cursor-pointer max-w-[120px] truncate"
              title="Dev Model Switcher"
            >
              {Object.entries(LM_STUDIO_MODELS).map(([key, value]) => (
                <option key={value} value={value} className="bg-background text-foreground font-sans">
                  {key}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Divider */}
        <div className="h-4 w-px bg-border/40" />

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
                className="absolute right-0 top-full mt-2 z-[300] w-52 rounded-lg bg-background/95 border border-border/60 shadow-2xl backdrop-blur-xl overflow-hidden"
              >
                <div className="py-1">
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
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

    </header>
  );
}
