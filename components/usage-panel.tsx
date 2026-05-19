"use client";

import { useEffect, useState } from "react";

interface OperationBreakdown {
  words:  number;
  tokens: number;
}

interface UsageData {
  monthKey:          string;
  plan:              string;
  wordsUsed:         number;
  wordsLimit:        number;
  wordsRemaining:    number;
  topUpWordsGranted: number;
  percentUsed:       number;
  breakdown: {
    transcribe: OperationBreakdown;
    analyze:    OperationBreakdown;
    insights:   OperationBreakdown;
    chat:       OperationBreakdown;
    studio:     OperationBreakdown;
  };
  resetAt: string;
}

interface UsagePanelProps {
  /** idToken from the Studio Firebase session */
  idToken:  string;
  /** compact = mini bar in sidebar footer; expanded = full settings tab */
  variant?: "compact" | "expanded";
}

function fmtWords(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}k`;
  return n.toString();
}

function resetLabel(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "next month";
  }
}

export function UsagePanel({ idToken, variant = "compact" }: UsagePanelProps) {
  const [usage, setUsage]     = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!idToken) return;
    fetch("https://www.fikr.one/api/user/usage", {
      headers: { Authorization: `Bearer ${idToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUsage(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [idToken]);

  if (loading) {
    return (
      <div className="px-3 py-2 opacity-40 animate-pulse">
        <div className="h-1.5 bg-current rounded-full w-full" />
      </div>
    );
  }

  if (!usage || usage.wordsLimit === -1) return null; // free / unlimited

  const pct        = Math.min(1, usage.wordsUsed / (usage.wordsLimit + (usage.topUpWordsGranted ?? 0)));
  const isAtLimit  = usage.wordsRemaining <= 0;
  const isNear     = usage.percentUsed >= 80 && !isAtLimit;

  const barColor = isAtLimit
    ? "#EF4444"
    : isNear
    ? "#F59E0B"
    : "#3CA6A6";

  if (variant === "compact") {
    return (
      <div className="px-3 py-2 space-y-1">
        <div className="flex items-center justify-between text-[10px] opacity-50">
          <span>AI Words</span>
          <span>{fmtWords(usage.wordsUsed)} / {fmtWords(usage.wordsLimit)}</span>
        </div>
        <div className="h-1 rounded-full bg-current opacity-10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${(pct * 100).toFixed(1)}%`, background: barColor }}
          />
        </div>
      </div>
    );
  }

  // expanded variant — Settings tab
  const ops: { label: string; key: keyof UsageData["breakdown"] }[] = [
    { label: "Transcription", key: "transcribe" },
    { label: "Analysis",      key: "analyze"    },
    { label: "Insights",      key: "insights"   },
    { label: "Chat",          key: "chat"       },
    { label: "Studio",        key: "studio"     },
  ];

  return (
    <div className="rounded-2xl border p-5 space-y-4"
      style={{ borderColor: isAtLimit ? "#EF444430" : isNear ? "#F59E0B30" : "#3CA6A630" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">AI Words — {usage.monthKey}</p>
          <p className="text-xs opacity-40 mt-0.5">Resets {resetLabel(usage.resetAt)}</p>
        </div>
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-full"
          style={{ background: `${barColor}18`, color: barColor }}>
          {usage.plan.toUpperCase()}
        </span>
      </div>

      {/* Main bar */}
      <div>
        <div className="flex justify-between text-xs opacity-50 mb-1.5">
          <span>{fmtWords(usage.wordsUsed)} used</span>
          <span>{fmtWords(usage.wordsRemaining)} remaining</span>
        </div>
        <div className="h-2 rounded-full bg-black/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${(pct * 100).toFixed(1)}%`, background: barColor }}
          />
        </div>
        <p className="text-xs opacity-40 mt-1 text-right">
          {fmtWords(usage.wordsUsed)} / {fmtWords(usage.wordsLimit)} words
        </p>
      </div>

      {/* Breakdown */}
      <div className="space-y-2 pt-1">
        {ops.map(({ label, key }) => {
          const w   = usage.breakdown[key]?.words ?? 0;
          const opP = usage.wordsLimit > 0 ? Math.min(1, w / usage.wordsLimit) : 0;
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs w-24 shrink-0 opacity-60">{label}</span>
              <div className="flex-1 h-1 rounded-full bg-black/8 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(opP * 100).toFixed(1)}%`, background: "#3CA6A6" }} />
              </div>
              <span className="text-xs w-14 text-right opacity-50">{fmtWords(w)}</span>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <a
        href="https://www.fikr.one/billing/topup"
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full text-center text-sm font-medium py-2.5 rounded-full border transition-colors"
        style={{ color: "#3CA6A6", borderColor: "#3CA6A6" }}>
        Buy 750,000 more words — $4.50
      </a>
    </div>
  );
}
