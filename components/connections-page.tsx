"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Check, Copy, ExternalLink, Loader2, Plug, Zap, AlertTriangle, RefreshCw, Wrench, Sparkles, Lock, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export interface ConnectionsPageProps {
  mcpPort: number | null;
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

const getIntegrations = (mcpPort: number | null): Integration[] => {
  const port = mcpPort ? mcpPort.toString() : "3025";
  return [
  {
    id: "claude",
    name: "Claude Desktop",
    tagline: "Ask Claude questions about your notes directly.",
    description: "Ask Claude questions about your notes. 'What did I capture last week about the Fikr redesign?' Claude pulls context directly from your canvas.",
    iconSrc: "/brand-icons/claude-color.svg",
    iconBg: "#D97757", iconLetter: "C",
    category: "MCP Clients",
    connectionType: "1-click",
    requiresPlan: null,
    steps: [
      { label: "Click Install below", detail: "Fikr Studio writes the config and restarts Claude automatically." },
      { label: "Open Claude Desktop", detail: "Start a new conversation — the 🔌 icon shows available tools." },
    ],
    snippet: JSON.stringify({ mcpServers: { "fikr-studio": { command: "npx", args: ["-y", "fikr-studio-mcp@latest", `http://localhost:${port}/sse`] } } }, null, 2),
    snippetLang: "json",
    docsUrl: "https://docs.anthropic.com/en/docs/developer/mcp",
    primaryActionLabel: "Install",
  },
  {
    id: "windsurf",
    name: "Windsurf",
    tagline: "Cascade AI reads your canvas context while you code.",
    description: "While coding in Windsurf (Cascade), your AI has access to your Fikr notes as context. Capture code decisions directly to your canvas from the chat.",
    iconSrc: "/brand-icons/windsurf.svg",
    iconBg: "#3CA6A6", iconLetter: "W",
    category: "MCP Clients",
    connectionType: "1-click",
    requiresPlan: null,
    steps: [
      { label: "Click Install below", detail: "Fikr Studio writes to ~/.codeium/windsurf/mcp_settings.json automatically." },
      { label: "Restart Windsurf", detail: "Open Cascade — the Fikr tools will be available." },
    ],
    snippet: JSON.stringify({ mcpServers: { "fikr-studio": { serverUrl: `http://localhost:${port}/sse` } } }, null, 2),
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
    snippet: JSON.stringify({ mcpServers: { "fikr-studio": { url: `http://localhost:${port}/sse`, type: "sse" } } }, null, 2),
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
    snippet: JSON.stringify({ servers: { "fikr-studio": { type: "http", url: `http://localhost:${port}/sse` } } }, null, 2),
    snippetLang: "json",
    docsUrl: "https://github.com/features/copilot",
    primaryActionLabel: "Copy Config",
  },
  {
    id: "geminicli",
    name: "Gemini CLI",
    tagline: "Run Gemini from terminal with your canvas as context.",
    description: "Use Google's Gemini CLI with access to your Fikr notes as context. Run `gemini` from terminal and it can query your canvas.",
    iconSrc: "/brand-icons/geminicli-color.svg",
    iconBg: "#4285F4", iconLetter: "G",
    category: "MCP Clients",
    connectionType: "copy-config",
    requiresPlan: null,
    steps: [
      { label: "Copy config below", detail: "Edit ~/.gemini/settings.json and paste the config." },
      { label: "Ensure Gemini CLI is installed", detail: "npm install -g @google/gemini-cli" },
    ],
    snippet: JSON.stringify({ mcpServers: { "fikr-studio": { httpUrl: `http://localhost:${port}/sse` } } }, null, 2),
    snippetLang: "json",
    docsUrl: "https://ai.google.dev/gemini-api/docs",
    primaryActionLabel: "Copy Config",
  },
  {
    id: "github",
    name: "GitHub MCP",
    tagline: "Browse issues, PRs, repos, and CI status from your AI.",
    description: "Connect your AI client to GitHub. Read issues, PRs, repos, and CI/CD status — all accessible from Claude, Cursor, etc. Official GitHub MCP server (29.5k ⭐).",
    iconSrc: "/brand-icons/github.svg",
    iconBg: "#24292e", iconLetter: "G",
    category: "MCP Clients",
    connectionType: "copy-config",
    requiresPlan: null,
    steps: [
      { label: "Copy config below", detail: "Add to your MCP client config (Claude, Cursor, etc)." },
      { label: "Authenticate", detail: "First use triggers GitHub OAuth — no token stored manually." },
    ],
    snippet: JSON.stringify({ servers: { github: { type: "http", url: "https://api.githubcopilot.com/mcp/" } } }, null, 2),
    snippetLang: "json",
    docsUrl: "https://github.com/github/github-mcp-server",
    primaryActionLabel: "Copy Config",
  },
  ];
};

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
function AgentPromptCard({ mcpPort, plan, relayApiKey }: { mcpPort: number | null; plan: string; relayApiKey: string }) {
  const isPlusPro = plan.toLowerCase().includes("plus") || plan.toLowerCase().includes("pro");
  const port = mcpPort ?? 3025;
  const skillUrl = isPlusPro ? "https://fikr.one/skills/fikr-studio.md" : `http://localhost:${port}/skill.md`;
  const agentPrompt = `Fetch ${skillUrl} and follow the instructions to connect to Fikr Studio.`;
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
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{label}</span>
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
        <pre className="px-3.5 pb-3.5 text-emerald-400 text-[10.5px] font-mono leading-relaxed overflow-x-auto whitespace-pre max-h-36 overflow-y-auto">
          {code}
        </pre>
      ) : (
        <p className="px-3.5 pb-3.5 text-zinc-300 text-[12px] leading-relaxed">{code}</p>
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

  // Resolve the right config for this integration + plan
  const cloudKey = relayApiKey || "<your-relay-key>";
  
  const config = isMcpClient && isPlusPro
    ? JSON.stringify({
        mcpServers: {
          "fikr-studio": {
            command: "npx",
            args: ["-y", "fikr-studio-mcp", "https://fikr.one/api/mcp/relay"],
            env: { MCP_RELAY_KEY: cloudKey },
          },
        },
      }, null, 2)
    : integration.snippet;

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
            {isMcpClient && !isPlusPro && (
              <div className="px-3.5 py-2 border-t border-white/[0.06]">
                <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                  Requires Studio running locally.{" "}
                  <a href="https://fikr.one/pricing" target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline inline-flex items-center gap-1">
                    Upgrade for cloud relay <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>
            )}
            {isMcpClient && isPlusPro && (
              <div className="px-3.5 py-2 border-t border-white/[0.06]">
                <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                  ✦ Cloud relay — works without Studio running locally.
                </p>
              </div>
            )}
          </SnippetBox>

          {/* Agent Prompt box — MCP clients only */}
          {isMcpClient && (
            <AgentPromptCard mcpPort={mcpPort} plan={plan} relayApiKey={relayApiKey} />
          )}

          {/* Setup steps */}
          <div className="pt-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">How to set up</p>
            <ol className="space-y-3">
              {integration.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">
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

  return (
    <div
      className="flex items-center justify-between p-4 rounded-2xl border border-border/40 bg-card/50 hover:bg-muted/50 transition-colors cursor-pointer group"
      onClick={onOpen}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <BrandIcon integration={integration} size={36} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-sm text-foreground">{integration.name}</span>
            {isInstalled && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                <Check className="h-3 w-3" /> Connected
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-[400px]">
            {integration.tagline}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
        {isOneClick && !isInstalled && (
          <button
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
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
        <button
          className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5"
          onClick={onOpen}
        >
          Setup
        </button>
      </div>
    </div>
  );
}

// -- Page Component --
export function ConnectionsPage({ mcpPort, plan, relayApiKey }: ConnectionsPageProps) {
  const ipc = useIpc();
  const isPlusPro = plan.toLowerCase().includes("plus") || plan.toLowerCase().includes("pro");

  const [statuses, setStatuses] = useState<Record<string, StatusType>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showConnectSheet, setShowConnectSheet] = useState(false);

  const INTEGRATIONS = useMemo(() => getIntegrations(mcpPort), [mcpPort]);
  const selectedIntegration = INTEGRATIONS.find((i) => i.id === selectedId) ?? null;

  const claudeStatus = statuses["claude"] ?? "not_configured";
  const windsurfStatus = statuses["windsurf"] ?? "not_configured";

  // Generic connection config snippet for Copy Connection Code action (port-agnostic)
  const genericSnippet = isPlusPro
    ? JSON.stringify({
        mcpServers: {
          "fikr-studio": {
            command: "npx",
            args: ["-y", "fikr-studio-mcp", "https://fikr.one/api/mcp/relay"],
            env: { MCP_RELAY_KEY: relayApiKey || "<your-relay-key>" }
          }
        }
      }, null, 2)
    : JSON.stringify({
        mcpServers: {
          "fikr-studio": {
            command: "npx",
            args: ["-y", "fikr-studio-mcp"]
          }
        }
      }, null, 2);

  const handleCopyGenericCode = async () => {
    await navigator.clipboard.writeText(genericSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

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
    <div className="space-y-6">
      {/* Connection Action Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-card/60 via-card/30 to-muted/20 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-3.5">
            <div className="shrink-0 h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mt-0.5">
              <Plug className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-foreground">Connect Fikr to your AI Assistants</h3>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md uppercase tracking-wider">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              </div>
              <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
                Connect Fikr Studio to your AI tools to let them read, write, and search your notes.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* 1-Click Connect */}
            <Button
              size="sm"
              onClick={() => setShowConnectSheet(true)}
              className="font-bold text-xs px-4 h-9 cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5 mr-1.5" /> 1-Click Connect
            </Button>

            {/* Generic Copy Code */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyGenericCode}
              className="font-semibold text-xs px-4 h-9 cursor-pointer"
            >
              {copiedCode ? (
                <><Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> Copied Code</>
              ) : (
                <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Connection Code</>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
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

      {/* 1-Click Connect App Selector Sheet */}
      <Sheet open={showConnectSheet} onOpenChange={setShowConnectSheet}>
        <SheetContent side="right" className="w-full sm:max-w-[400px] p-6 bg-background border-l border-border/20 flex flex-col">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-base font-bold flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              1-Click Connect AI Apps
            </SheetTitle>
            <SheetDescription className="text-xs">
              Select a supported AI app to automatically configure it to connect with Fikr Studio.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4">
            {/* Claude Desktop Option */}
            <div className="p-4 rounded-xl border border-border/40 bg-card hover:bg-muted/30 transition-colors flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-[#D97757]/10 flex items-center justify-center font-bold text-[#D97757] text-sm">C</div>
                <div>
                  <h4 className="font-semibold text-xs text-foreground">Claude Desktop</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Status: {claudeStatus === "installed" ? "Connected" : "Not connected"}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant={claudeStatus === "installed" ? "secondary" : "default"}
                onClick={() => {
                  if (claudeStatus === "installed") {
                    handleUninstall("claude");
                  } else {
                    handleInstall("claude");
                  }
                }}
                disabled={installing === "claude"}
                className="text-[10px] h-8 font-bold px-3 cursor-pointer"
              >
                {installing === "claude" ? "Loading..." : claudeStatus === "installed" ? "Disconnect" : "Connect"}
              </Button>
            </div>

            {/* Windsurf Option */}
            <div className="p-4 rounded-xl border border-border/40 bg-card hover:bg-muted/30 transition-colors flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-[#3CA6A6]/10 flex items-center justify-center font-bold text-[#3CA6A6] text-sm">W</div>
                <div>
                  <h4 className="font-semibold text-xs text-foreground">Windsurf</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Status: {windsurfStatus === "installed" ? "Connected" : "Not connected"}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant={windsurfStatus === "installed" ? "secondary" : "default"}
                onClick={() => {
                  if (windsurfStatus === "installed") {
                    handleUninstall("windsurf");
                  } else {
                    handleInstall("windsurf");
                  }
                }}
                disabled={installing === "windsurf"}
                className="text-[10px] h-8 font-bold px-3 cursor-pointer"
              >
                {installing === "windsurf" ? "Loading..." : windsurfStatus === "installed" ? "Disconnect" : "Connect"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Detail Sheet */}
      <IntegrationSheet
        integration={selectedIntegration}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        mcpPort={mcpPort}
        plan={plan}
        relayApiKey={relayApiKey}
        statuses={statuses}
        onInstall={handleInstall}
        onUninstall={handleUninstall}
        installing={installing}
      />
    </div>
  );
}
