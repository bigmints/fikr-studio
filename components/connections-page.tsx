"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Check, Copy, ExternalLink, Loader2, Zap, AlertTriangle, RefreshCw, Wrench, Sparkles, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export interface ConnectionsPageProps {
  mcpPort: number | null;
  mcpToken: string | null;
  plan: string;
  relayApiKey: string;
}

type ConnectionType = "1-click" | "copy-config" | "copy-endpoint" | "paste-url" | "rest-api";
type StatusType = "not_configured" | "installed" | "checking" | "error";
type RequiresPlan = "plus" | null;

interface Step { label: string; detail: string; }
interface Integration {
  id: string;
  name: string;
  tagline: string;
  description: string;
  iconSrc?: string;
  iconEmoji?: string;
  iconBg: string;
  iconLetter: string;
  category: string;
  connectionType: ConnectionType;
  requiresPlan: RequiresPlan;   // null = free, "plus" = Plus/Pro required
  steps: Step[];
  snippet: string;
  snippetLang: string;
  docsUrl: string;
  primaryActionLabel: string;
}

const getIntegrations = (mcpPort: number | null, mcpToken: string | null): Integration[] => {
  const port = mcpPort ? mcpPort.toString() : "3025";
  const endpoint = `http://localhost:${port}/sse?token=${encodeURIComponent(mcpToken ?? "<local-token>")}`;
  return [
  {
    id: "claude",
    name: "Claude Desktop",
    tagline: "Ask Claude questions about your notes directly.",
    description: "Ask Claude questions about your notes. 'What did I capture last week about the Fikr redesign?' Claude pulls context directly from your workspace.",
    iconSrc: "/brand-icons/claude-color.svg",
    iconBg: "#D97757", iconLetter: "C",
    category: "MCP Clients",
    connectionType: "1-click",
    requiresPlan: null,
    steps: [
      { label: "Click Install below", detail: "Fikr Studio writes the local MCP configuration securely." },
      { label: "Restart Claude Desktop", detail: "Start a new conversation — the 🔌 icon shows available tools." },
    ],
    snippet: JSON.stringify({ mcpServers: { "fikr-studio": { url: endpoint, type: "sse" } } }, null, 2),
    snippetLang: "json",
    docsUrl: "https://docs.anthropic.com/en/docs/developer/mcp",
    primaryActionLabel: "Install",
  },
  {
    id: "windsurf",
    name: "Windsurf",
    tagline: "Cascade AI reads your notes while you code.",
    description: "While coding in Windsurf (Cascade), your AI has access to your Fikr notes as context. Capture code decisions directly to your workspace from the chat.",
    iconSrc: "/brand-icons/windsurf.svg",
    iconBg: "#3CA6A6", iconLetter: "W",
    category: "MCP Clients",
    connectionType: "1-click",
    requiresPlan: null,
    steps: [
      { label: "Click Install below", detail: "Fikr Studio writes to ~/.codeium/windsurf/mcp_settings.json automatically." },
      { label: "Restart Windsurf", detail: "Open Cascade — the Fikr tools will be available." },
    ],
    snippet: JSON.stringify({ mcpServers: { "fikr-studio": { serverUrl: endpoint } } }, null, 2),
    snippetLang: "json",
    docsUrl: "https://docs.codeium.com/windsurf/mcp",
    primaryActionLabel: "Install",
  },
  {
    id: "cursor",
    name: "Cursor",
    tagline: "Read and write Fikr notes during coding sessions.",
    description: "In Cursor Agent mode, your AI can read and write Fikr notes as part of coding sessions. Great for capturing architectural decisions.",
    iconSrc: "/brand-icons/cursor.svg",
    iconBg: "#1A1A1A", iconLetter: "C",
    category: "MCP Clients",
    connectionType: "copy-config",
    requiresPlan: null,
    steps: [
      { label: "Copy config below", detail: "Click Copy to copy the JSON snippet." },
      { label: "Edit ~/.cursor/mcp.json", detail: "Create or edit the file and paste the config." },
      { label: "Restart Cursor", detail: "In Cursor Chat, type: @fikr-studio list my recent notes" },
    ],
    snippet: JSON.stringify({ mcpServers: { "fikr-studio": { url: endpoint, type: "sse" } } }, null, 2),
    snippetLang: "json",
    docsUrl: "https://cursor.com",
    primaryActionLabel: "Copy Config",
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    tagline: "Fikr notes as context in VS Code Agent mode.",
    description: "In VS Code Agent mode with Copilot Chat, Fikr notes are available as a context source. Ask Copilot to check your notes before writing code.",
    iconSrc: "/brand-icons/copilot-color.svg",
    iconBg: "#24292e", iconLetter: "G",
    category: "MCP Clients",
    connectionType: "copy-config",
    requiresPlan: null,
    steps: [
      { label: "Requires VS Code ≥ 1.101", detail: "Earlier versions do not support remote MCP." },
      { label: "Copy config below", detail: "Create .vscode/mcp.json in your workspace root and paste." },
      { label: "Switch to Agent mode", detail: "Open Copilot Chat → toggle Agent mode in the chat input." },
    ],
    snippet: JSON.stringify({ servers: { "fikr-studio": { type: "http", url: endpoint } } }, null, 2),
    snippetLang: "json",
    docsUrl: "https://github.com/features/copilot",
    primaryActionLabel: "Copy Config",
  },
  {
    id: "geminicli",
    name: "Gemini CLI",
    tagline: "Run Gemini from terminal with your notes as context.",
    description: "Use Google's Gemini CLI with access to your Fikr notes as context. Run `gemini` from terminal and it can query your workspace.",
    iconSrc: "/brand-icons/geminicli-color.svg",
    iconBg: "#4285F4", iconLetter: "G",
    category: "MCP Clients",
    connectionType: "copy-config",
    requiresPlan: null,
    steps: [
      { label: "Copy config below", detail: "Edit ~/.gemini/settings.json and paste the config." },
      { label: "Ensure Gemini CLI is installed", detail: "npm install -g @google/gemini-cli" },
    ],
    snippet: JSON.stringify({ mcpServers: { "fikr-studio": { httpUrl: endpoint } } }, null, 2),
    snippetLang: "json",
    docsUrl: "https://ai.google.dev/gemini-api/docs",
    primaryActionLabel: "Copy Config",
  },
  {
    id: "other",
    name: "Others",
    tagline: "Connect any other MCP-compatible AI client.",
    description: "Use this JSON configuration to connect any other MCP client (like Cline, LibreChat, or other agent tools) locally to Fikr Studio. Requires Fikr Studio to be running.",
    iconBg: "#4B5563", iconLetter: "O",
    category: "MCP Clients",
    connectionType: "copy-config",
    requiresPlan: null,
    steps: [
      { label: "Copy config below", detail: "Click Copy to copy the local configuration snippet." },
      { label: "Paste into your client", detail: "Paste this into your AI client's MCP configuration settings." },
    ],
    snippet: JSON.stringify({
      mcpServers: {
        "fikr-studio": {
          url: endpoint,
          type: "sse"
        }
      }
    }, null, 2),
    snippetLang: "json",
    docsUrl: "https://modelcontextprotocol.io",
    primaryActionLabel: "Copy Config",
  },
  ];
}

// -- Helpers --
function useIpc() {
  if (typeof window === "undefined") return null;
  return (window as any).fikrStudio ?? null;
}

// -- Upgrade Wall --
function UpgradeWall({ category, integrations }: { category: string; integrations: Integration[] }) {
  return (
    <div className="relative rounded-2xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/[0.04] to-violet-500/[0.03] overflow-hidden">
      {/* Blurred preview of integrations */}
      <div className="p-4 space-y-2 select-none pointer-events-none" style={{ filter: "blur(1.5px)", opacity: 0.45 }}>
        {integrations.slice(0, 3).map(i => (
          <div key={i.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border/20">
            <BrandIcon integration={i} size={36} />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[13px] text-foreground">{i.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{i.tagline}</p>
            </div>
          </div>
        ))}
        {integrations.length > 3 && (
          <div className="text-center text-[11px] text-muted-foreground py-1">
            +{integrations.length - 3} more integrations
          </div>
        )}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 bg-gradient-to-t from-background/80 via-background/60 to-transparent">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Lock className="h-5 w-5 text-primary" />
        </div>
        <div className="text-center max-w-xs">
          <p className="font-bold text-foreground mb-1">{category} requires Plus or Pro</p>
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            {category === "Webhooks"
              ? "Webhooks require a publicly reachable URL. Upgrade to get a dedicated cloud relay endpoint at fikr.one."
              : "REST & automation integrations use the Fikr cloud relay. Upgrade to connect Zapier, Make, Notion, and more."}
          </p>
        </div>
        <button
          onClick={() => window.open("https://fikr.one/pricing", "_blank")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-bold hover:bg-primary/90 transition-colors shadow-sm"
          style={{ boxShadow: "0 4px 16px color-mix(in srgb, var(--primary) 30%, transparent)" }}
        >
          <Sparkles className="h-4 w-4" /> Upgrade to Plus
        </button>
      </div>
    </div>
  );
}

function BrandIcon({ integration, size = 40 }: { integration: Integration; size?: number }) {
  const [err, setErr] = useState(false);
  const glow = integration.iconBg;
  if (integration.iconEmoji) {
    return (
      <div
        className="shrink-0 rounded-2xl flex items-center justify-center text-xl"
        style={{
          width: size, height: size,
          background: `linear-gradient(135deg, ${glow}28 0%, ${glow}12 100%)`,
          border: `1.5px solid ${glow}35`,
          boxShadow: `0 2px 12px ${glow}20`,
        }}
      >
        {integration.iconEmoji}
      </div>
    );
  }
  if (integration.iconSrc && !err) {
    return (
      <div
        className="shrink-0 rounded-2xl flex items-center justify-center"
        style={{
          width: size, height: size,
          background: `linear-gradient(135deg, ${glow}18 0%, ${glow}08 100%)`,
          border: `1.5px solid ${glow}25`,
          boxShadow: `0 2px 12px ${glow}18, inset 0 1px 0 rgba(255,255,255,0.6)`,
        }}
      >
        <img
          src={integration.iconSrc}
          alt={integration.name}
          onError={() => setErr(true)}
          style={{ width: size * 0.58, height: size * 0.58, objectFit: "contain" }}
        />
      </div>
    );
  }
  return (
    <div
      className="shrink-0 rounded-2xl flex items-center justify-center font-black text-white"
      style={{
        width: size, height: size,
        background: `linear-gradient(135deg, ${glow} 0%, ${glow}bb 100%)`,
        boxShadow: `0 2px 12px ${glow}40`,
        fontSize: size * 0.38,
      }}
    >
      {integration.iconLetter}
    </div>
  );
}


function StatusDot({ status }: { status: StatusType }) {
  const map: Record<StatusType, { dot: string; text: string; pulse: boolean }> = {
    not_configured: { dot: "bg-zinc-300 dark:bg-zinc-600",  text: "text-zinc-400 dark:text-zinc-500", pulse: false },
    checking:       { dot: "bg-amber-400",                  text: "text-amber-600 dark:text-amber-400", pulse: true  },
    installed:      { dot: "bg-emerald-500",                text: "text-emerald-600 dark:text-emerald-400", pulse: false },
    error:          { dot: "bg-red-500",                    text: "text-red-500", pulse: false },
  };
  const labels: Record<StatusType, string> = {
    not_configured: "Not connected",
    checking: "Checking…",
    installed: "Connected",
    error: "Error",
  };
  const { dot, text, pulse } = map[status];
  return (
    <span className={`flex items-center gap-1.5 text-[11px] font-semibold ${text}`}>
      <span className={`h-2 w-2 rounded-full ${dot} ${pulse ? "animate-pulse" : ""}`} />
      {labels[status]}
    </span>
  );
}

function CodeSnippet({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group rounded-xl overflow-hidden border border-border/20">
      <pre className="p-4 bg-black/90 text-emerald-400 text-[11px] font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
      >
        {copied ? <><Check className="h-3 w-3 text-emerald-400" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
      </button>
    </div>
  );
}

// -- Agent Prompt Card --
function AgentPromptCard({ mcpPort, mcpToken }: { mcpPort: number | null; mcpToken: string | null }) {
  const port = mcpPort ?? 3025;
  const skillUrl = `http://localhost:${port}/skill.md?token=${encodeURIComponent(mcpToken ?? "<local-token>")}`;
  const endpoint = `http://localhost:${port}/sse?token=${encodeURIComponent(mcpToken ?? "<local-token>")}`;
  const agentPrompt = `Fetch ${skillUrl}, then connect to the local MCP endpoint ${endpoint}.`;
  return <SnippetBox label="Agent Prompt" code={agentPrompt} mono={false} />;
}

// -- Snippet Box --
function SnippetBox({ label, code, mono = true, children }: { label: string; code: string; mono?: boolean; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.06] bg-zinc-950">
      {/* Label row */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
        <span className="text-[11px] font-semibold text-zinc-400">{label}</span>
        <button
          onClick={copy}
          className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md transition-all ${
            copied
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
          }`}
        >
          {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
        </button>
      </div>
      {/* Code area */}
      {mono ? (
        <pre className="px-3.5 pb-3.5 text-emerald-400 text-[10.5px] font-mono leading-relaxed overflow-x-auto whitespace-pre max-h-60 overflow-y-auto">
          {code}
        </pre>
      ) : (
        <p className="px-3.5 pb-3.5 text-zinc-300 text-[12px] leading-relaxed whitespace-pre-wrap font-sans">{code}</p>
      )}
      {children}
    </div>
  );
}

// -- Detail Sheet --
function IntegrationSheet({
  integration,
  open,
  onClose,
  mcpPort,
  mcpToken,
  plan,
  relayApiKey,
  statuses,
  onInstall,
  onUninstall,
  installing,
}: {
  integration: Integration | null;
  open: boolean;
  onClose: () => void;
  mcpPort: number | null;
  mcpToken: string | null;
  plan: string;
  relayApiKey: string;
  statuses: Record<string, StatusType>;
  onInstall: (id: string) => void;
  onUninstall: (id: string) => void;
  installing: string | null;
}) {
  const isPlusPro = plan.toLowerCase().includes("plus") || plan.toLowerCase().includes("pro");
  const isMcpClient = integration?.category === "MCP Clients";

  if (!integration) return null;

  const status = statuses[integration.id] ?? "not_configured";

  const config = integration.snippet;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[440px] overflow-y-auto p-0 border-l border-border/20 bg-background flex flex-col"
      >
        {/* Header — tight */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/10">
          <BrandIcon integration={integration} size={40} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-[15px] font-bold tracking-tight leading-none">{integration.name}</SheetTitle>
              <StatusDot status={status} />
            </div>
            <SheetDescription className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
              {integration.tagline}
            </SheetDescription>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 px-5 py-4 space-y-4">

          {/* MCP Config box */}
          <SnippetBox label="MCP Config" code={config}>
            {isMcpClient && (
              <div className="px-3.5 py-2 border-t border-white/[0.06]">
                <p className="text-[11px] text-zinc-500">
                  {isPlusPro ? (
                    <>✦ Runs locally. Use <strong>Fikr Cloud Relay</strong> details on the main page to connect remotely.</>
                  ) : (
                    <>
                      Requires Studio running locally.{" "}
                      <a href="https://fikr.one/pricing" target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline inline-flex items-center gap-1">
                        Upgrade for cloud relay <ExternalLink className="h-3 w-3" />
                      </a>
                    </>
                  )}
                </p>
              </div>
            )}
          </SnippetBox>

          {/* Agent Prompt box — MCP clients only */}
          {isMcpClient && (
            <AgentPromptCard mcpPort={mcpPort} mcpToken={mcpToken} />
          )}

          {/* Setup steps */}
          <div className="pt-1">
            <p className="text-[12px] font-semibold text-foreground mb-3">How to connect</p>
            <ol className="space-y-3">
              {integration.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 h-5 w-5 rounded-full bg-muted text-foreground text-[11px] font-semibold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-foreground leading-snug">{step.label}</p>
                    {step.detail && <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{step.detail}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* 1-click install */}
          {integration.connectionType === "1-click" && (
            <div className="flex gap-2">
              <Button
                className="flex-1 h-10 font-bold"
                variant={status === "installed" ? "secondary" : "default"}
                onClick={() => onInstall(integration.id)}
                disabled={installing === integration.id}
              >
                {installing === integration.id ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> {status === "installed" ? "Reconnecting…" : "Installing…"}</>
                ) : status === "installed" ? (
                  <><RefreshCw className="h-4 w-4" /> Reconnect</>
                ) : (
                  <><Zap className="h-4 w-4" /> {integration.primaryActionLabel}</>
                )}
              </Button>
              {status === "installed" && (
                <Button
                  variant="outline"
                  className="h-10 px-4 font-bold border-red-500/20 text-red-500 hover:bg-red-500/10"
                  onClick={() => onUninstall(integration.id)}
                  disabled={installing === integration.id}
                >
                  {installing === integration.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Disconnect"}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/10">
          <a
            href={integration.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            View official docs <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// -- Row Item --
function IntegrationRow({
  integration,
  status,
  onOpen,
  onInstall,
  onUninstall,
  installing,
}: {
  integration: Integration;
  status: StatusType;
  onOpen: () => void;
  onInstall: (id: string) => void;
  onUninstall: (id: string) => void;
  installing: string | null;
}) {
  const isInstalled = status === "installed";
  const isOneClick = integration.connectionType === "1-click";
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(integration.snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy snippet: ", err);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${integration.name} connection details`}
      className="group -mx-3 flex min-h-[72px] cursor-pointer items-center justify-between rounded-lg border-b border-transparent px-4 py-3 transition-[background-color,box-shadow] duration-150 hover:bg-secondary/55 hover:shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--border)_45%,transparent)] focus-visible:bg-secondary/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="shrink-0 transition-transform duration-150 group-hover:scale-[1.03] group-focus-visible:scale-[1.03]">
          <BrandIcon integration={integration} size={32} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-sm text-foreground">{integration.name}</span>
            {isInstalled && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="h-3 w-3" /> Connected
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate max-w-[200px] transition-colors group-hover:text-foreground/70 group-focus-visible:text-foreground/70 sm:max-w-[400px]">
            {integration.tagline}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        {isOneClick && !isInstalled && (
          <button
            className="flex min-h-8 items-center gap-1 rounded-md bg-foreground px-3 text-xs font-semibold text-background transition-opacity hover:opacity-80"
            onClick={() => onInstall(integration.id)}
            disabled={installing === integration.id}
          >
            {installing === integration.id ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Installing…</>
            ) : (
              <><Zap className="h-3.5 w-3.5" /> Install</>
            )}
          </button>
        )}
        {!isOneClick && (
          <button
            className={`flex min-h-8 items-center gap-1 px-3 rounded-md text-xs font-semibold transition-colors ${
              copied
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-secondary/80 text-secondary-foreground transition-colors group-hover:bg-foreground group-hover:text-background group-focus-visible:bg-foreground group-focus-visible:text-background hover:opacity-80"
            }`}
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// -- Page Component --
export function ConnectionsPage({ mcpPort, mcpToken, plan, relayApiKey }: ConnectionsPageProps) {
  const ipc = useIpc();

  const [statuses, setStatuses] = useState<Record<string, StatusType>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);

  const isPlusPro = plan.toLowerCase().includes("plus") || plan.toLowerCase().includes("pro");
  const INTEGRATIONS = useMemo(() => getIntegrations(mcpPort, mcpToken), [mcpPort, mcpToken]);
  const selectedIntegration = INTEGRATIONS.find((i) => i.id === selectedId) ?? null;

  // Auto-check 1-click integrations on mount
  const checkStatus = useCallback(async (id: string) => {
    if (!ipc?.testMcp) return;
    setStatuses((s) => ({ ...s, [id]: "checking" }));
    try {
      const result = await ipc.testMcp(id);
      setStatuses((s) => ({ ...s, [id]: result?.ok ? "installed" : "not_configured" }));
    } catch {
      setStatuses((s) => ({ ...s, [id]: "error" }));
    }
  }, [ipc]);

  useEffect(() => {
    INTEGRATIONS.filter((i) => i.connectionType === "1-click").forEach((i) => checkStatus(i.id));
  }, [checkStatus, INTEGRATIONS]);

  const handleInstall = async (id: string) => {
    if (!ipc?.installMcp) return;
    setInstalling(id);
    try {
      await ipc.installMcp(id);
      setStatuses((s) => ({ ...s, [id]: "installed" }));
    } catch {
      setStatuses((s) => ({ ...s, [id]: "error" }));
    } finally {
      setInstalling(null);
    }
  };

  const handleUninstall = async (id: string) => {
    if (!ipc?.uninstallMcp) return;
    setInstalling(id); // reuse the installing state for loading spinner
    try {
      await ipc.uninstallMcp(id);
      setStatuses((s) => ({ ...s, [id]: "not_configured" }));
    } catch {
      setStatuses((s) => ({ ...s, [id]: "error" }));
    } finally {
      setInstalling(null);
    }
  };

  return (
    <>
      {/* Cloud Relay Card */}
      {isPlusPro ? (
        <section className="mb-6 border-b border-border/60 pb-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-[14px] text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                Fikr Cloud Relay
              </h3>
              <p className="text-[12px] text-muted-foreground mt-1 max-w-md leading-relaxed">
                Connect to Fikr Studio from remote environments. Copy the prompt or the connection details below.
              </p>
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">
              Plus / Pro
            </span>
          </div>

          <Tabs defaultValue="agent-prompt" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted p-1 rounded-md mb-3 h-auto">
              <TabsTrigger value="agent-prompt" className="text-xs font-semibold py-1.5 rounded-md">
                For AI Agents
              </TabsTrigger>
              <TabsTrigger value="manual-instructions" className="text-xs font-semibold py-1.5 rounded-md">
                For Humans
              </TabsTrigger>
            </TabsList>

            <TabsContent value="agent-prompt">
              <SnippetBox
                label="Agent Connection Prompt"
                code={`Connect to my Fikr workspace via the Fikr Cloud Relay. The MCP server runs locally inside my Fikr Studio desktop app, and the cloud relay tunnels requests securely.\n\n### Connection Information:\n- Relay Endpoint URL: https://fikr.one/api/mcp/relay\n- Relay API Key: ${relayApiKey || "<your-relay-key>"}\n\n### How to connect:\n1. Fetch the official agent skill at https://fikr.one/skills/fikr-studio.md to understand the available note-taking, search, and workspace tools.\n2. Connect and call the tools using either the SSE protocol or by sending Stateless JSON-RPC HTTP POST requests directly to the Relay Endpoint URL with the Bearer authorization header.`}
                mono={false}
              />
            </TabsContent>

            <TabsContent value="manual-instructions">
              <SnippetBox
                label="How to connect"
                code={`Whether you want to connect a web AI assistant or run custom commands, follow the steps below:\n\n### Option 1 — Copy & Paste to your AI assistant (Easiest)\n1. Copy the prompt from the "For AI Agents" tab.\n2. Paste it directly into your AI agent's chat window (e.g. ChatGPT, Claude, Gemini).\n\n### Option 2 — Developer HTTP API (Curl)\nRun this curl command in your terminal to verify connection:\n\`\`\`bash\ncurl -X POST https://fikr.one/api/mcp/relay \\\n  -H "Authorization: Bearer ${relayApiKey || "<your-relay-key>"}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_projects","arguments":{}},"id":1}'\n\`\`\``}
                mono={false}
              />
            </TabsContent>
          </Tabs>
        </section>
      ) : (
        <section className="mb-6 border-b border-border/60 pb-6 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-[14px] text-foreground flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-muted-foreground" />
                Fikr Cloud Relay (Remote)
              </h3>
              <p className="text-[12px] text-muted-foreground mt-1 max-w-md leading-relaxed">
                Connect from remote environments while Fikr Studio is running. Upgrade for the authenticated cloud tunnel.
              </p>
            </div>
            <button
              onClick={() => window.open("https://fikr.one/pricing", "_blank")}
              className="text-[11px] font-bold text-primary hover:underline inline-flex items-center gap-1"
            >
              Upgrade to Plus <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </section>
      )}

      <div>
        {INTEGRATIONS.map((integration) => (
          <IntegrationRow
            key={integration.id}
            integration={integration}
            status={statuses[integration.id] ?? "not_configured"}
            onOpen={() => setSelectedId(integration.id)}
            onInstall={handleInstall}
            onUninstall={handleUninstall}
            installing={installing}
          />
        ))}
      </div>

      {/* Detail Sheet */}
      <IntegrationSheet
        integration={selectedIntegration}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        mcpPort={mcpPort}
        mcpToken={mcpToken}
        plan={plan}
        relayApiKey={relayApiKey}
        statuses={statuses}
        onInstall={handleInstall}
        onUninstall={handleUninstall}
        installing={installing}
      />
    </>
  );
}
