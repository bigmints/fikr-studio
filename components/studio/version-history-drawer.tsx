"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, RotateCcw, Save, ChevronRight, Sparkles, User } from "lucide-react";
import type { ArticleVersion } from "@/lib/generate/types";

interface Props {
  versions: ArticleVersion[];
  currentMarkdown: string;
  onClose: () => void;
  onSave: () => void;        // manual "Save current version"
  onRevert: (versionId: string) => void;
}

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function formatAbsoluteTime(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function VersionHistoryDrawer({
  versions,
  currentMarkdown,
  onClose,
  onSave,
  onRevert,
}: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // Reverse-chronological display
  const sorted = [...versions].sort((a, b) => b.savedAt - a.savedAt);

  const handleSave = useCallback(() => {
    onSave();
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  }, [onSave]);

  const handleRevert = useCallback((versionId: string) => {
    onRevert(versionId);
    setConfirmId(null);
    onClose();
  }, [onRevert, onClose]);

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 340, damping: 36 }}
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: 320,
        display: "flex",
        flexDirection: "column",
        background: "var(--background)",
        borderLeft: "1px solid color-mix(in oklch, var(--border) 60%, transparent)",
        boxShadow: "-12px 0 40px rgba(0,0,0,0.10)",
        zIndex: 100,
        overflow: "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 16px 12px",
        borderBottom: "1px solid color-mix(in oklch, var(--border) 40%, transparent)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Clock size={14} style={{ color: "var(--primary)" }} />
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>
            Version History
          </span>
          {versions.length > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: "1px 6px",
              borderRadius: 20, background: "color-mix(in oklch, var(--primary) 12%, transparent)",
              color: "var(--primary)", fontFamily: "var(--font-mono)",
            }}>
              {versions.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            padding: 5, borderRadius: 6, border: "none", background: "none",
            cursor: "pointer", color: "var(--muted-foreground)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in oklch, var(--foreground) 8%, transparent)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          title="Close (⌘H)"
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Save current version CTA ────────────────────────────────────────── */}
      <div style={{
        padding: "10px 12px",
        borderBottom: "1px solid color-mix(in oklch, var(--border) 30%, transparent)",
        flexShrink: 0,
      }}>
        <button
          onClick={handleSave}
          disabled={!currentMarkdown?.trim()}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            width: "100%", padding: "8px 12px", borderRadius: 8,
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: "1px solid color-mix(in oklch, var(--primary) 30%, transparent)",
            background: savedFlash
              ? "color-mix(in oklch, var(--primary) 15%, transparent)"
              : "color-mix(in oklch, var(--primary) 6%, transparent)",
            color: "var(--primary)",
            transition: "all 0.2s",
            opacity: !currentMarkdown?.trim() ? 0.4 : 1,
          }}
        >
          <Save size={12} />
          {savedFlash ? "✓ Version saved!" : "Save current version"}
          <span style={{
            marginLeft: "auto", fontSize: 9, fontFamily: "var(--font-mono)",
            color: "color-mix(in oklch, var(--primary) 60%, transparent)",
            fontWeight: 500,
          }}>
            ⌘S
          </span>
        </button>
      </div>

      {/* ── Version list ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}
        className="custom-scrollbar"
      >
        {sorted.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 10, padding: "48px 24px", textAlign: "center",
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "color-mix(in oklch, var(--foreground) 6%, transparent)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Clock size={16} style={{ color: "var(--muted-foreground)", opacity: 0.4 }} />
            </div>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5, margin: 0 }}>
              No versions yet. Versions are saved automatically on generation and when you click "Save current version".
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {sorted.map((v, idx) => (
              <VersionRow
                key={v.id}
                version={v}
                index={idx}
                isConfirming={confirmId === v.id}
                onConfirmRequest={() => setConfirmId(v.id)}
                onConfirmCancel={() => setConfirmId(null)}
                onConfirm={() => handleRevert(v.id)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* ── Footer hint ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: "10px 16px",
        borderTop: "1px solid color-mix(in oklch, var(--border) 30%, transparent)",
        flexShrink: 0,
      }}>
        <p style={{ fontSize: 10, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5, opacity: 0.6 }}>
          Reverting creates a "Before revert" snapshot so you can always undo the revert.
        </p>
      </div>
    </motion.div>
  );
}

// ── Individual version row ────────────────────────────────────────────────────

interface RowProps {
  version: ArticleVersion;
  index: number;
  isConfirming: boolean;
  onConfirmRequest: () => void;
  onConfirmCancel: () => void;
  onConfirm: () => void;
}

function VersionRow({ version, index, isConfirming, onConfirmRequest, onConfirmCancel, onConfirm }: RowProps) {
  const [hovered, setHovered] = useState(false);

  const labelColor = version.isManual
    ? "var(--primary)"
    : "var(--muted-foreground)";

  const dotColor = version.isManual
    ? "var(--primary)"
    : "color-mix(in oklch, var(--foreground) 25%, transparent)";

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(index * 0.04, 0.3) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "10px 12px",
        margin: "0 6px 2px",
        borderRadius: 8,
        background: hovered || isConfirming
          ? "color-mix(in oklch, var(--foreground) 4%, transparent)"
          : "none",
        transition: "background 0.15s",
        cursor: "default",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>

        {/* Dot indicator */}
        <div style={{ paddingTop: 3, flexShrink: 0 }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: dotColor,
            boxShadow: version.isManual ? `0 0 0 2px color-mix(in oklch, var(--primary) 25%, transparent)` : "none",
          }} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            {version.isManual
              ? <User size={10} style={{ color: labelColor, flexShrink: 0 }} />
              : <Sparkles size={10} style={{ color: "var(--muted-foreground)", flexShrink: 0, opacity: 0.5 }} />
            }
            <span style={{
              fontSize: 12, fontWeight: version.isManual ? 600 : 500,
              color: labelColor,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {version.label}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{ fontSize: 10, color: "var(--muted-foreground)", opacity: 0.6 }}
              title={formatAbsoluteTime(version.savedAt)}
            >
              {formatRelativeTime(version.savedAt)}
            </span>
            <span style={{ fontSize: 9, opacity: 0.3, color: "var(--foreground)" }}>·</span>
            <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted-foreground)", opacity: 0.5 }}>
              {version.wordCount.toLocaleString()} words
            </span>
          </div>

          {/* Confirm / Revert CTA */}
          <AnimatePresence>
            {(hovered || isConfirming) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                style={{ overflow: "hidden", marginTop: 8 }}
              >
                {isConfirming ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "var(--muted-foreground)", flex: 1 }}>
                      Restore this version?
                    </span>
                    <button
                      onClick={onConfirmCancel}
                      style={{
                        fontSize: 11, padding: "3px 8px", borderRadius: 5,
                        border: "1px solid color-mix(in oklch, var(--border) 60%, transparent)",
                        background: "none", cursor: "pointer",
                        color: "var(--muted-foreground)",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={onConfirm}
                      style={{
                        fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 5,
                        border: "none", background: "var(--primary)",
                        color: "var(--primary-foreground)", cursor: "pointer",
                      }}
                    >
                      Restore
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={onConfirmRequest}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      fontSize: 11, fontWeight: 500, padding: "4px 8px", borderRadius: 5,
                      border: "1px solid color-mix(in oklch, var(--border) 60%, transparent)",
                      background: "none", cursor: "pointer",
                      color: "var(--foreground)", opacity: 0.7,
                      transition: "opacity 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
                  >
                    <RotateCcw size={10} />
                    Restore this version
                    <ChevronRight size={10} style={{ marginLeft: "auto" }} />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
