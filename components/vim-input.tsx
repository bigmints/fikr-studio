"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trello,
  Grid,
  Trash2,
  Clipboard,
  Download,
  FolderOpen,
  FolderPlus,
  BookOpen,
  Sparkles,
  FolderDown,
  FolderInput,
  GitFork,
  Keyboard,
  ChevronRight,
} from "lucide-react";
import { Command } from "cmdk";
import { useModKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

// ─── Props ───────────────────────────────────────────────────────────────────

interface VimInputProps {
  onSubmit: (text: string) => void;
  onCommand: (cmd: string, text?: string) => void;
  isCommandKOpen: boolean;
  setIsCommandKOpen: (open: boolean) => void;
}

// ─── Command definitions ────────────────────────────────────────────────────

interface CmdItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub?: string;
  shortcut?: string[];
}

function useCommandItems(): CmdItem[][] {
  const mod = useModKey();
  const modSym = mod === "⌘" ? "⌘" : "Ctrl";

  return React.useMemo(
    () => [
      // Views
      [
        {
          id: "tiling",
          icon: Grid,
          label: "Tiling View",
          sub: "Spatial canvas",
        },
        {
          id: "kanban",
          icon: Trello,
          label: "Kanban View",
          sub: "Board layout",
        },
        {
          id: "graph",
          icon: GitFork,
          label: "Graph View",
          sub: "Relationship map",
        },
      ],
      // Navigate
      [
        {
          id: "open-projects",
          icon: FolderOpen,
          label: "Open Projects",
          sub: "Browse projects",
        },
        {
          id: "new-project",
          icon: FolderPlus,
          label: "New Project",
          sub: "Create blank project",
        },
        {
          id: "open-index",
          icon: BookOpen,
          label: "Workspace Index",
          sub: "Tile index",
        },
        {
          id: "open-synthesis",
          icon: Sparkles,
          label: "Synthesis Panel",
          sub: "AI insights",
        },
      ],
      // Actions
      [
        {
          id: "export-nodepad",
          icon: FolderDown,
          label: "Export as .nodepad",
          shortcut: [modSym, "Shift", "E"],
        },
        {
          id: "import-nodepad",
          icon: FolderInput,
          label: "Import .nodepad",
          shortcut: [modSym, "Shift", "I"],
        },
        {
          id: "export-md",
          icon: Download,
          label: "Export as Markdown",
          shortcut: [modSym, "E"],
        },
        {
          id: "copy-md",
          icon: Clipboard,
          label: "Copy as Markdown",
          shortcut: [modSym, "C"],
        },
        {
          id: "clear",
          icon: Trash2,
          label: "Clear Canvas",
          sub: "Remove all blocks",
        },
      ],
      // Help
      [
        {
          id: "keyboard-shortcuts",
          icon: Keyboard,
          label: "Keyboard Shortcuts",
          sub: "View all shortcuts",
        },
      ],
    ],
    [modSym],
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VimInput({
  onSubmit,
  onCommand,
  isCommandKOpen,
  setIsCommandKOpen,
}: VimInputProps) {
  const [value, setValue] = React.useState("");
  const [search, setSearch] = React.useState("");
  const mod = useModKey();
  const commandGroups = useCommandItems();

  const mainInputRef = React.useRef<HTMLInputElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Reset search when opening
  React.useEffect(() => {
    if (isCommandKOpen) {
      setSearch("");
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [isCommandKOpen]);

  // Flat list of all items for filtering
  const allItems = React.useMemo(() => commandGroups.flat(), [commandGroups]);

  const filteredGroups = React.useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return commandGroups;

    return commandGroups
      .map((group) =>
        group.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            (item.sub && item.sub.toLowerCase().includes(q)),
        ),
      )
      .filter((group) => group.length > 0);
  }, [search, commandGroups]);

  const handleSelect = React.useCallback(
    (cmdId: string) => {
      onCommand(cmdId, value);
      setSearch("");
      setIsCommandKOpen(false);
      requestAnimationFrame(() => mainInputRef.current?.focus());
    },
    [onCommand, value, setIsCommandKOpen],
  );

  const handleClose = React.useCallback(() => {
    setIsCommandKOpen(false);
    setSearch("");
    requestAnimationFrame(() => mainInputRef.current?.focus());
  }, [setIsCommandKOpen]);

  const groupHeadings = ["Views", "Navigate", "Actions", "Help"];

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="w-full relative z-110 flex flex-col items-center">
        {/* ── Command Menu Dialog ────────────────────────────────────────── */}
        <Dialog open={isCommandKOpen} onOpenChange={setIsCommandKOpen}>
          <DialogHeader className="sr-only">
            <DialogTitle>Command Menu</DialogTitle>
            <DialogDescription>
              Search and execute commands quickly.
            </DialogDescription>
          </DialogHeader>
          <DialogContent
            className="gap-0 overflow-hidden rounded-xl border-border/50 p-0 shadow-2xl sm:max-w-lg bg-background/95 backdrop-blur-xl"
            showCloseButton={false}
          >
           <Command className="w-full h-full">
            {/* Search header */}
            <div className="flex h-12 items-center gap-2 border-border/50 border-b px-4">
              <Command.Input
                ref={searchInputRef}
                value={search}
                onValueChange={setSearch}
                placeholder="Type a command or search..."
                className="flex h-10 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/60"
                autoFocus
              />
              <button
                type="button"
                onClick={handleClose}
                className="flex shrink-0 items-center"
              >
                <Kbd className="text-[10px]">Esc</Kbd>
              </button>
            </div>

            {/* Command list */}
            <div className="max-h-105 overflow-y-auto py-2 scrollbar-none">
              {filteredGroups.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-muted-foreground/60">
                    No commands found
                  </p>
                </div>
              ) : (
                filteredGroups.map((group, gi) => (
                  <div key={gi} className="mb-1">
                    {/* Group heading */}
                    <div className="px-4 py-1.5">
                      <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                        {groupHeadings[gi] ?? ""}
                      </span>
                    </div>

                    {/* Group items */}
                    {group.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelect(item.id)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent/50 hover:text-accent-foreground data-[state=checked]:bg-accent"
                      >
                        <item.icon className="shrink-0 opacity-60" />
                        <div className="flex-1">
                          <div className="text-[13px] font-medium leading-snug">
                            {item.label}
                          </div>
                          {item.sub && (
                            <div className="text-[11px] text-muted-foreground/60">
                              {item.sub}
                            </div>
                          )}
                        </div>
                        {item.shortcut && (
                          <KbdGroup className="ml-auto">
                            {item.shortcut.map((key) => (
                              <Kbd key={key}>{key}</Kbd>
                            ))}
                          </KbdGroup>
                        )}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-border/50 border-t px-4 py-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Kbd className="text-[9px]">↑↓</Kbd>
                  <span className="text-[10px] text-muted-foreground/60">
                    navigate
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Kbd className="text-[9px]">↵</Kbd>
                  <span className="text-[10px] text-muted-foreground/60">
                    select
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Kbd className="text-[9px]">esc</Kbd>
                <span className="text-[10px] text-muted-foreground/60">
                  close
                </span>
              </div>
            </div>
           </Command>
          </DialogContent>
        </Dialog>

        {/* ── Main Input Bar ─────────────────────────────────────────────── */}
        <div className="w-full border-t border-border/40 bg-background/80 backdrop-blur-3xl px-6 py-5 flex items-center gap-4 transition-all duration-300 focus-within:border-primary/40 relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-primary/20 to-transparent" />

          <div className="flex items-center gap-3 flex-1">
            <div className="font-mono text-[10px] font-bold text-foreground/50 uppercase tracking-[0.2em] select-none">
              Entry
            </div>
            <input
              ref={mainInputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && value.trim() && !isCommandKOpen) {
                  onSubmit(value.trim());
                  setValue("");
                }
              }}
              placeholder="Capture something..."
              className="flex-1 bg-transparent font-mono text-sm tracking-tight text-foreground outline-none placeholder:text-muted-foreground/60"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Kbd className="h-5 text-[9px]">
                <span className="text-[11px] mr-0.5">⌘</span>Z
              </Kbd>
              <span className="text-[9px] font-mono font-bold text-foreground/50 uppercase tracking-tighter">
                Undo
              </span>
            </div>

            <div className="h-4 w-px bg-foreground/10" />

            <div className="flex items-center gap-2">
              <Kbd className="h-5 text-[9px]">
                <span className="text-[11px] mr-0.5">⌘</span>K
              </Kbd>
              <span className="text-[9px] font-mono font-bold text-foreground/50 uppercase tracking-tighter">
                Commands
              </span>
            </div>

            <div className="h-4 w-px bg-foreground/15" />

            <button
              onClick={() => {
                if (value.trim()) {
                  onSubmit(value.trim());
                  setValue("");
                  setIsCommandKOpen(false);
                }
              }}
              className="font-mono text-[10px] font-bold text-primary uppercase tracking-widest hover:brightness-125 transition-all active:scale-95 disabled:opacity-20"
              disabled={!value.trim()}
            >
              Submit
            </button>
          </div>
        </div>
    </div>
  );
}
