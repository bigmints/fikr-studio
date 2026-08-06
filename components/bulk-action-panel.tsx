"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  FolderUp,
  GitMerge,
  LayoutGrid,
  Trash2,
  X,
  ChevronRight,
  ArrowLeft,
  Check,
  Tag,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Project {
  id: string;
  name: string;
}

interface BulkActionPanelProps {
  isOpen: boolean;
  selectedCount: number;
  projects: Project[];
  activeProjectId: string;
  onClose: () => void;
  onDelete: () => void;
  onMove: (targetProjectId: string) => void;
  onResynthesize: () => void;
  onRecategorize: (newCategory: string) => void;
}

type SubView = "root" | "move" | "recategorize";

export function BulkActionPanel({
  isOpen,
  selectedCount,
  projects,
  activeProjectId,
  onClose,
  onDelete,
  onMove,
  onResynthesize,
  onRecategorize,
}: BulkActionPanelProps) {
  const [subView, setSubView] = useState<SubView>("root");
  const [newCategory, setNewCategory] = useState("");
  const categoryInputRef = useRef<HTMLInputElement>(null);

  // Reset sub-view whenever panel opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSubView("root");
      setNewCategory("");
    }
  }, [isOpen]);

  // Focus category input when recategorize view opens
  useEffect(() => {
    if (subView === "recategorize" && categoryInputRef.current) {
      categoryInputRef.current.focus();
    }
  }, [subView]);

  const otherProjects = projects.filter((p) => p.id !== activeProjectId);

  const handleMoveConfirm = (targetId: string) => {
    onMove(targetId);
    setSubView("root");
  };

  const handleRecategorizeConfirm = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    onRecategorize(trimmed);
    setNewCategory("");
    setSubView("root");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 240 }}
          className="absolute right-0 top-0 bottom-0 w-72 bg-background border-l border-border/40 shadow-2xl z-50 flex flex-col overflow-hidden"
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/20 shrink-0">
            <div className="flex items-center gap-2">
              {subView !== "root" && (
                <button
                  onClick={() => setSubView("root")}
                  className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              )}
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground/70">
                  {subView === "root"
                    ? "Bulk Actions"
                    : subView === "move"
                    ? "Move to workspace"
                    : "Set Category"}
                </p>
                <p className="text-[13px] font-semibold text-foreground leading-tight">
                  {selectedCount} note{selectedCount !== 1 ? "s" : ""} selected
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              {/* ────── Root view ────── */}
              {subView === "root" && (
                <motion.div
                  key="root"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.14 }}
                  className="p-3 space-y-1"
                >
                  {/* Resynthesize */}
                  <ActionRow
                    icon={<GitMerge className="w-4 h-4" />}
                    iconColor="text-primary"
                    iconBg="bg-primary/10"
                    label="Resynthesize"
                    description="Re-enrich with AI"
                    onClick={onResynthesize}
                  />

                  {/* Recategorize */}
                  <ActionRow
                    icon={<Tag className="w-4 h-4" />}
                    iconColor="text-violet-400"
                    iconBg="bg-violet-400/10"
                    label="Recategorize"
                    description="Assign new category"
                    onClick={() => setSubView("recategorize")}
                    chevron
                  />

                  {/* Move to workspace */}
                  <ActionRow
                    icon={<FolderUp className="w-4 h-4" />}
                    iconColor="text-sky-400"
                    iconBg="bg-sky-400/10"
                    label="Move to workspace"
                    description={
                      otherProjects.length === 0
                        ? "No other workspaces"
                        : "Transfer notes"
                    }
                    onClick={() => {
                      if (otherProjects.length > 0) setSubView("move");
                    }}
                    chevron
                    disabled={otherProjects.length === 0}
                  />

                  {/* Divider */}
                  <div className="h-px w-full bg-border/40 my-2" />

                  {/* Delete */}
                  <ActionRow
                    icon={<Trash2 className="w-4 h-4" />}
                    iconColor="text-destructive"
                    iconBg="bg-destructive/10"
                    label="Delete"
                    description="Remove from workspace"
                    onClick={onDelete}
                    destructive
                  />
                </motion.div>
              )}

              {/* ────── Move to workspace ────── */}
              {subView === "move" && (
                <motion.div
                  key="move"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.14 }}
                  className="p-3 space-y-1"
                >
                  {otherProjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No other workspaces to move to
                    </p>
                  ) : (
                    otherProjects.map((project) => (
                      <button
                        key={project.id}
                        onClick={() => handleMoveConfirm(project.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors group text-left"
                      >
                        <div className="w-7 h-7 rounded-md bg-sky-400/10 text-sky-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {project.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="flex-1 text-[13px] font-medium text-foreground/90 truncate">
                          {project.name}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                      </button>
                    ))
                  )}
                </motion.div>
              )}

              {/* ────── Recategorize ────── */}
              {subView === "recategorize" && (
                <motion.div
                  key="recategorize"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.14 }}
                  className="p-4 space-y-4"
                >
                  <p className="text-[12px] text-muted-foreground leading-snug">
                    Type a category name to assign to all {selectedCount} selected
                    note{selectedCount !== 1 ? "s" : ""}. The AI will preserve the
                    new category during future enrichment.
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/20 px-3 py-2.5 focus-within:border-primary/50 focus-within:bg-primary/5 transition-all">
                      <Tag className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                      <input
                        ref={categoryInputRef}
                        type="text"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRecategorizeConfirm();
                          if (e.key === "Escape") setSubView("root");
                        }}
                        placeholder="e.g. Architecture, Research..."
                        className="flex-1 bg-transparent text-[13px] font-medium text-foreground outline-none placeholder:text-muted-foreground/40"
                      />
                      {newCategory.trim() && (
                        <button
                          onClick={() => setNewCategory("")}
                          className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <button
                      onClick={handleRecategorizeConfirm}
                      disabled={!newCategory.trim()}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-all"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Apply to {selectedCount} note{selectedCount !== 1 ? "s" : ""}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Shared action row component ─────────────────────────────────────────────
interface ActionRowProps {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  label: string;
  description: string;
  onClick: () => void;
  chevron?: boolean;
  disabled?: boolean;
  destructive?: boolean;
}

function ActionRow({
  icon,
  iconColor,
  iconBg,
  label,
  description,
  onClick,
  chevron,
  disabled,
  destructive,
}: ActionRowProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group text-left disabled:opacity-40 disabled:cursor-not-allowed ${
        destructive
          ? "hover:bg-destructive/10 text-destructive"
          : "hover:bg-secondary"
      }`}
    >
      <div
        className={`w-7 h-7 rounded-md ${iconBg} ${iconColor} flex items-center justify-center shrink-0`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-[13px] font-semibold leading-none mb-0.5 ${
            destructive ? "text-destructive" : "text-foreground/90"
          }`}
        >
          {label}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">
          {description}
        </p>
      </div>
      {chevron && !disabled && (
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
      )}
    </button>
  );
}
