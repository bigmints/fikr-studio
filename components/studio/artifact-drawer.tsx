"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Copy, Download, ExternalLink, Check,
  Sparkles, Image as ImageIcon, Share2, X, Shuffle, Layout,
} from "lucide-react";
import { Textfit } from "react-textfit";
import type { StudioProject } from "@/lib/generate/types";

// ── Platform config ─────────────────────────────────────────────────────────
const PLATFORMS: Record<string, {
  label: string; url: string; cardStyle: string; titleSize: number;
  bg: string; fg: string; accent: string; layout: "landscape" | "portrait" | "square";
  fontFamily: string; logo: string;
}> = {
  linkedin: {
    label: "LinkedIn", url: "https://www.linkedin.com/feed/",
    cardStyle: "professional", titleSize: 24, layout: "landscape",
    bg: "#0A66C2", fg: "#ffffff", accent: "rgba(255,255,255,0.15)",
    fontFamily: "'Inter', system-ui, sans-serif", logo: "in",
  },
  substack: {
    label: "Substack", url: "https://substack.com/",
    cardStyle: "newsletter", titleSize: 28, layout: "portrait",
    bg: "#ffffff", fg: "#1a1a1a", accent: "#ff6719",
    fontFamily: "'Georgia', 'Times New Roman', serif", logo: "S",
  },
  twitter: {
    label: "Twitter / X", url: "https://twitter.com/compose/tweet",
    cardStyle: "minimal", titleSize: 22, layout: "square",
    bg: "#000000", fg: "#ffffff", accent: "rgba(255,255,255,0.12)",
    fontFamily: "'Inter', system-ui, sans-serif", logo: "𝕏",
  },
  medium: {
    label: "Medium", url: "https://medium.com/new-story",
    cardStyle: "editorial", titleSize: 26, layout: "landscape",
    bg: "#fafafa", fg: "#1a1a1a", accent: "#e0e0e0",
    fontFamily: "'Georgia', serif", logo: "M",
  },
};

function openExternal(url: string) {
  const ipc = typeof window !== "undefined" && (window as any).fikrStudio;
  if (ipc?.openUrl) ipc.openUrl(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

interface Props { project: StudioProject; markdown: string; onClose: () => void; onDone: () => void; }

// ── Social Card Component ───────────────────────────────────────────────────
function SocialCard({ title, snippet, platform, gradientIdx, ratioOverride }: {
  title: string; snippet: string; platform: string; gradientIdx: number; ratioOverride?: string;
}) {
  const cfg = PLATFORMS[platform] ?? PLATFORMS.linkedin;

  const gradients = [
    `linear-gradient(135deg, ${cfg.bg} 0%, color-mix(in oklch, ${cfg.bg} 70%, #000) 100%)`,
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  ];

  let finalRatio = cfg.layout === "portrait" ? "4/5" : cfg.layout === "square" ? "1/1" : "16/9";
  if (ratioOverride && ratioOverride !== "auto") {
    finalRatio = ratioOverride;
  }

  const [rw, rh] = finalRatio.split('/').map(Number);
  const ratioNum = rw / rh;
  const isTall = ratioNum <= 0.95;
  const paddingStr = isTall ? "44px 32px 60px 32px" : "40px 40px 60px 40px";

  return (
    <div
      style={{
        width: "100%",
        aspectRatio: finalRatio,
        background: gradients[gradientIdx] ?? gradients[0],
        borderRadius: 20,
        padding: paddingStr,
        display: "flex", flexDirection: "column",
        justifyContent: "space-between",
        position: "relative", overflow: "hidden",
        fontFamily: cfg.fontFamily,
        color: gradientIdx === 0 ? cfg.fg : "#fff",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}
    >
      {/* Noise overlay */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.05, pointerEvents: "none",
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        backgroundSize: "200px",
      }} />
      {/* Glow blob */}
      <div style={{
        position: "absolute", bottom: -60, right: -60, width: 240, height: 240, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)", pointerEvents: "none",
      }} />

      {/* Top: logo + platform */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: gradientIdx === 0 ? cfg.accent : "rgba(255,255,255,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 900, color: gradientIdx === 0 ? cfg.fg : "#fff",
        }}>
          {cfg.logo}
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          Fikr Studio
        </span>
      </div>

      {/* Middle: title + snippet */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: isTall ? "32px 0" : "24px 0", gap: 16, overflow: "hidden" }}>
        <div style={{ flex: 4, minHeight: 0 }}>
          <Textfit mode="multi" min={16} max={cfg.titleSize * 1.6} style={{ width: "100%", height: "100%", fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
            {title}
          </Textfit>
        </div>
        <div style={{ flex: 6, minHeight: 0 }}>
          <Textfit mode="multi" min={10} max={21} style={{ width: "100%", height: "100%", lineHeight: 1.5, opacity: 0.85 }}>
            {snippet}
          </Textfit>
        </div>
      </div>

      {/* Bottom: CTA */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.15)" }}>
        <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.65, textTransform: "capitalize" }}>
          Read on {cfg.label}
        </span>
        <div style={{
          fontSize: 11, fontWeight: 700, padding: "5px 14px", borderRadius: 20,
          background: gradientIdx === 0 ? cfg.accent : "rgba(255,255,255,0.2)",
          letterSpacing: "0.02em",
        }}>
          Read Article →
        </div>
      </div>
    </div>
  );
}

// ── Share Sheet ─────────────────────────────────────────────────────────────
function ShareSheet({ onClose, onSelectPlatform, currentPlatform }: {
  onClose: () => void;
  onSelectPlatform: (p: string) => void;
  currentPlatform: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[700] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 34 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480, margin: "0 auto",
          background: "var(--background)",
          borderRadius: "24px 24px 0 0",
          padding: "12px 0 32px",
          border: "1px solid color-mix(in oklch, var(--border) 60%, transparent)",
          borderBottom: "none",
        }}
      >
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 16 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border)" }} />
        </div>

        <div style={{ padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Share to Platform</p>
            <button onClick={onClose} className="studio-icon-btn"><X className="size-4" /></button>
          </div>

          {/* Platform grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {Object.entries(PLATFORMS).map(([key, cfg]) => {
              const isActive = key === currentPlatform;
              return (
                <button
                  key={key}
                  onClick={() => { onSelectPlatform(key); onClose(); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "14px 16px", borderRadius: 14, textAlign: "left", cursor: "pointer",
                    border: `1.5px solid ${isActive ? "var(--primary)" : "color-mix(in oklch, var(--border) 60%, transparent)"}`,
                    background: isActive ? "color-mix(in oklch, var(--primary) 10%, transparent)" : "color-mix(in oklch, var(--secondary) 40%, transparent)",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: cfg.bg, color: cfg.fg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 900, boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  }}>
                    {cfg.logo}
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>{cfg.label}</p>
                    {isActive && <p style={{ fontSize: 10, color: "var(--primary)", margin: 0, fontWeight: 600 }}>Current</p>}
                  </div>
                </button>
              );
            })}
          </div>

          <p style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "center", marginTop: 20, lineHeight: 1.5 }}>
            Changing platform updates the card design & opens the right destination.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export function ArtifactDrawer({ project, markdown, onClose }: Props) {
  const [mounted, setMounted]             = useState(false);
  const [gradientIdx, setGradientIdx]     = useState(0);
  const [platform, setPlatform]           = useState<string>(project.platform ?? "linkedin");
  const [ratioMode, setRatioMode]         = useState<string>("auto");
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [copied, setCopied]               = useState(false);
  const [mdCopied, setMdCopied]           = useState(false);
  const [capturing, setCapturing]         = useState(false);
  const [published, setPublished]         = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const title   = markdown.split("\n")[0]?.replace(/^#+\s*/, "") ?? project.name;
  const snippet = markdown.replace(/^#+.*\n/m, "").trim().substring(0, 380) + "…";
  const wordCount = markdown.trim().split(/\s+/).filter(Boolean).length;
  const cfg = PLATFORMS[platform] ?? PLATFORMS.linkedin;

  const RATIOS = [
    { id: "auto", label: "Auto Ratio" },
    { id: "1/1", label: "Square" },
    { id: "9/10", label: "9:10" },
    { id: "10/9", label: "10:9" },
  ];
  const currentRatioLabel = RATIOS.find(r => r.id === ratioMode)?.label ?? "Auto Ratio";

  const captureCard = useCallback(async () => {
    if (!cardRef.current) return null;
    setCapturing(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      return dataUrl;
    } finally {
      setCapturing(false);
    }
  }, []);

  const handleCopyImage = async () => {
    const dataUrl = await captureCard();
    if (!dataUrl) return;
    const res   = await fetch(dataUrl);
    const blob  = await res.blob();
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadImage = async () => {
    const dataUrl = await captureCard();
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${title.slice(0, 50).replace(/\s+/g, "-")}-card.png`;
    a.click();
  };

  const handleCopyMarkdown = async () => {
    await navigator.clipboard.writeText(markdown);
    setMdCopied(true);
    setTimeout(() => setMdCopied(false), 2200);
  };

  const handlePublish = () => {
    openExternal(cfg.url);
    setPublished(true);
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="publish-page"
        initial={{ opacity: 0, x: "100%" }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed inset-0 z-[600] flex flex-col overflow-hidden"
        style={{ background: "var(--background)" }}
      >
        {/* Header — studio-toolbar gives drag region, blur, border. Left div clears macOS traffic lights. */}
        <header className="studio-toolbar" style={{ height: 44, padding: "0 12px 0 0" }}>
          <div
            className="flex items-center gap-3"
            style={{ WebkitAppRegion: "no-drag", paddingLeft: 76 } as React.CSSProperties}
          >
            <button onClick={onClose} className="studio-icon-btn"><ArrowLeft className="size-4" /></button>
            <div style={{ width: 1, height: 16, background: "color-mix(in oklch, var(--border) 60%, transparent)" }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.2, color: "var(--foreground)", margin: 0 }}>
                Publish Article
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag", paddingRight: 4 } as React.CSSProperties}>
            <AnimatePresence>
              {published && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ fontSize: 11, fontWeight: 600, color: "var(--primary)", display: "flex", alignItems: "center", gap: 4 }}>
                  <Check className="size-3.5" /> Opened
                </motion.span>
              )}
            </AnimatePresence>
            <button onClick={() => setShowShareSheet(true)} className="studio-pill-btn flex items-center gap-1.5" style={{ padding: "5px 10px", borderRadius: 7 }}>
              <Share2 className="size-3" /> {cfg.label}
            </button>
            <button onClick={handlePublish} className="studio-pill-btn primary flex items-center gap-1.5" style={{ padding: "5px 12px", borderRadius: 7 }}>
              <ExternalLink className="size-3" /> Open {cfg.label}
            </button>
          </div>
        </header>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>

          {/* Left */}
          <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }} className="custom-scrollbar">
            <div style={{ maxWidth: 660, margin: "0 auto", padding: "44px 48px 80px" }}>

              {/* Page heading */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 36 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 14, flexShrink: 0,
                  background: "var(--primary)", color: "var(--primary-foreground)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.2, color: "var(--foreground)", margin: "0 0 6px" }}>
                    Your article is ready
                  </h1>
                  <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>
                    Download the card image and paste it when publishing to {cfg.label}.
                  </p>
                </div>
              </div>

              {/* Card section */}
              <section style={{ marginBottom: 40 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <span className="studio-params-label">Social Card — {cfg.label}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => {
                      const idx = RATIOS.findIndex(r => r.id === ratioMode);
                      setRatioMode(RATIOS[(idx + 1) % RATIOS.length].id);
                    }} className="studio-pill-btn flex items-center gap-1">
                      <Layout className="size-3" /> {currentRatioLabel}
                    </button>
                    <button onClick={() => setGradientIdx(i => (i + 1) % 6)} className="studio-pill-btn flex items-center gap-1">
                      <Shuffle className="size-3" /> Style
                    </button>
                    <button onClick={handleCopyImage} disabled={capturing}
                      className={`studio-pill-btn flex items-center gap-1 ${copied ? "active" : ""}`}>
                      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                      {capturing ? "Capturing…" : copied ? "Copied!" : "Copy"}
                    </button>
                    <button onClick={handleDownloadImage} disabled={capturing} className="studio-pill-btn flex items-center gap-1">
                      <ImageIcon className="size-3" /> Save
                    </button>
                  </div>
                </div>

                {/* Rendered card — this gets captured */}
                <div ref={cardRef}>
                  <SocialCard title={title} snippet={snippet} platform={platform} gradientIdx={gradientIdx} ratioOverride={ratioMode} />
                </div>

                <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 10, textAlign: "center" }}>
                  Copy the image above and paste it as a cover when publishing to {cfg.label}
                </p>
              </section>

              {/* Full article */}
              <section>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span className="studio-params-label">Full Article Markdown</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={handleCopyMarkdown} className={`studio-pill-btn flex items-center gap-1 ${mdCopied ? "active" : ""}`}>
                      {mdCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
                      {mdCopied ? "Copied!" : "Copy Text"}
                    </button>
                    <button onClick={() => {
                      const blob = new Blob([markdown], { type: "text/markdown" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `${title.slice(0, 50).replace(/\s+/g, "-")}.md`;
                      a.click();
                    }} className="studio-pill-btn flex items-center gap-1">
                      <Download className="size-3" /> .md
                    </button>
                  </div>
                </div>
                <div style={{
                  borderRadius: 14, padding: "20px 20px",
                  background: "color-mix(in oklch, var(--secondary) 40%, var(--background))",
                  border: "1px solid color-mix(in oklch, var(--border) 55%, transparent)",
                  maxHeight: 300, overflowY: "auto",
                }} className="custom-scrollbar">
                  <pre style={{ fontSize: 11.5, lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)", color: "var(--foreground)", opacity: 0.78, margin: 0 }}>
                    {markdown}
                  </pre>
                </div>
              </section>
            </div>
          </div>

          {/* Right rail */}
          <div className="studio-params-rail">
            <div className="studio-params-section">
              <span className="studio-params-label mb-2">Publishing to</span>
              <button onClick={() => setShowShareSheet(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  borderRadius: 12, cursor: "pointer", width: "100%", textAlign: "left",
                  background: "color-mix(in oklch, var(--secondary) 60%, transparent)",
                  border: "1px solid color-mix(in oklch, var(--border) 50%, transparent)",
                  transition: "all 0.15s",
                }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8, background: cfg.bg, color: cfg.fg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 900, flexShrink: 0,
                }}>
                  {cfg.logo}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>{cfg.label}</p>
                  <p style={{ fontSize: 10, color: "var(--muted-foreground)", margin: 0 }}>Tap to change</p>
                </div>
                <Share2 className="size-3.5" style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
              </button>
            </div>

            <div className="studio-params-section">
              <span className="studio-params-label mb-3">Article Stats</span>
              {[
                { label: "Words", value: wordCount.toLocaleString() },
                { label: "Read time", value: `~${Math.max(1, Math.ceil(wordCount / 238))} min` },
                { label: "Characters", value: markdown.length.toLocaleString() },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--foreground)" }}>{value}</span>
                </div>
              ))}
            </div>

            <div className="studio-params-section" style={{ flex: 1, border: "none" }}>
              <span className="studio-params-label mb-4">Publish Checklist</span>
              {["Copy the card image", "Copy the article text", `Open ${cfg.label}`, "Paste & add hashtags"].map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                    background: "var(--primary)", color: "var(--primary-foreground)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900,
                  }}>{i + 1}</div>
                  <span style={{ fontSize: 12, lineHeight: 1.5, color: "var(--foreground)", opacity: 0.72 }}>{s}</span>
                </div>
              ))}
            </div>

            <div style={{ padding: 16, borderTop: "1px solid color-mix(in oklch, var(--border) 40%, transparent)", flexShrink: 0 }}>
              <button onClick={handlePublish}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px 0", borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none",
                  background: "var(--primary)", color: "var(--primary-foreground)",
                  boxShadow: "0 4px 20px color-mix(in oklch, var(--primary) 30%, transparent)",
                  transition: "all 0.15s",
                }}>
                <ExternalLink className="size-4" /> Open {cfg.label}
              </button>
              <button onClick={onClose} className="studio-btn-ghost" style={{ width: "100%", marginTop: 8, justifyContent: "center", fontSize: 12 }}>
                ← Back to Editor
              </button>
            </div>
          </div>
        </div>

        {/* Share Sheet */}
        <AnimatePresence>
          {showShareSheet && (
            <ShareSheet
              onClose={() => setShowShareSheet(false)}
              onSelectPlatform={setPlatform}
              currentPlatform={platform}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
