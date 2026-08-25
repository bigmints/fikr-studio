"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Check, Copy, ExternalLink, Loader2, Zap, RefreshCw, Lock, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { writeClipboardText } from "@/lib/clipboard";
import { maskLocalMcpText } from "@/lib/connection-display.mjs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export interface ConnectionsPageProps {
  mcpPort: number | null;
  mcpToken: string | null;
  plan: string;
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
    tagline: "Ask Claude about your notes.",
    description: "Ask Claude questions about your notes. 'What did I capture last week about the Fikr redesign?' Claude pulls context directly from your workspace.",
    iconSrc: "/brand-icons/claude-color.svg",
    iconBg: "#D97757", iconLetter: "C",
    category: "MCP Clients",
    connectionType: "1-click",
    requiresPlan: null,
    steps: [
      { label: "Click Install below", detail: "Fikr writes the local MCP configuration securely." },
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
    tagline: "Use your notes while you code.",
    description: "While coding in Windsurf (Cascade), your AI has access to your Fikr notes as context. Capture code decisions directly to your workspace from the chat.",
    iconSrc: "/brand-icons/windsurf.svg",
    iconBg: "#3CA6A6", iconLetter: "W",
    category: "MCP Clients",
    connectionType: "1-click",
    requiresPlan: null,
    steps: [
      { label: "Click Install below", detail: "Fikr writes to ~/.codeium/windsurf/mcp_settings.json automatically." },
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
    tagline: "Read and write notes from Cursor.",
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
    tagline: "Bring Fikr context into Agent mode.",
    description: "In VS Code Agent mode with Copilot Chat, Fikr notes are available as a context source. Ask Copilot to check your notes before writing code.",
    iconSrc: "/brand-icons/copilot-color.svg",
    iconBg: "#24292e", iconLetter: "G",
    category: "MCP Clients",
    connectionType: "copy-config",
    requiresPlan: null,
    steps: [
      { label: "Requires VS Code ≥ 1.101", detail: "Earlier versions do not support this MCP connection." },
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
    tagline: "Use your notes from the terminal.",
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
    tagline: "Connect any MCP-compatible app.",
    description: "Use this JSON configuration to connect any other MCP client (like Cline, LibreChat, or other agent tools) locally to Fikr. Requires Fikr to be running.",
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

function BrandIcon({ integration, size = 40 }: { integration: Integration; size?: number }) {
  const [err, setErr] = useState(false);
  if (integration.iconEmoji) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-md bg-secondary/70 text-xl"
        style={{ width: size, height: size }}
      >
        {integration.iconEmoji}
      </div>
    );
  }
  if (integration.iconSrc && !err) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-md bg-secondary/70"
        style={{ width: size, height: size }}
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
      className="flex shrink-0 items-center justify-center rounded-md bg-secondary/70 font-semibold text-foreground"
      style={{
        width: size, height: size,
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
    <span className={`flex items-center gap-1.5 text-xs font-semibold ${text}`}>
      <span className={`h-2 w-2 rounded-full ${dot} ${pulse ? "animate-pulse" : ""}`} />
      {labels[status]}
    </span>
  );
}

// -- Agent Prompt Card --
function AgentPromptCard({ mcpPort, mcpToken }: { mcpPort: number | null; mcpToken: string | null }) {
  const port = mcpPort ?? 3025;
  const skillUrl = `http://localhost:${port}/skill.md?token=${encodeURIComponent(mcpToken ?? "<local-token>")}`;
  const endpoint = `http://localhost:${port}/sse?token=${encodeURIComponent(mcpToken ?? "<local-token>")}`;
  const agentPrompt = `Fetch ${skillUrl}, then connect to the local MCP endpoint ${endpoint}.`;
  return <SnippetBox label="Agent Prompt" code={agentPrompt} visibleCode={maskLocalMcpText(agentPrompt, mcpToken)} mono={false} />;
}

// -- Snippet Box --
function SnippetBox({ label, code, visibleCode = code, mono = true, children }: { label: string; code: string; visibleCode?: string; mono?: boolean; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await writeClipboardText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.06] bg-zinc-950">
      {/* Label row */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
        <span className="text-xs font-semibold text-zinc-400">{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={copy}
          className={`h-7 gap-1 px-2.5 text-xs font-semibold ${
            copied
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
          }`}
        >
          {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
        </Button>
      </div>
      {/* Code area */}
      {mono ? (
        <pre className="px-3.5 pb-3.5 text-emerald-400 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre max-h-60 overflow-y-auto">
          {visibleCode}
        </pre>
      ) : (
        <p className="px-3.5 pb-3.5 text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap font-sans">{visibleCode}</p>
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
  statuses: Record<string, StatusType>;
  onInstall: (id: string) => void;
  onUninstall: (id: string) => void;
  installing: string | null;
}) {
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
              <SheetTitle className="text-sm font-bold tracking-tight leading-none">{integration.name}</SheetTitle>
              <StatusDot status={status} />
            </div>
            <SheetDescription className="text-xs text-muted-foreground mt-0.5 leading-snug">
              {integration.tagline}
            </SheetDescription>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 px-5 py-4 space-y-4">

          {/* MCP Config box */}
          <SnippetBox label="MCP Config" code={config} visibleCode={maskLocalMcpText(config, mcpToken)}>
            {isMcpClient && (
              <div className="px-3.5 py-2 border-t border-white/[0.06]">
                <p className="text-xs text-zinc-500">
                  Free local connection. The AI client must run on this computer, and Fikr must stay open.
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
            <p className="text-xs font-semibold text-foreground mb-3">How to connect</p>
            <ol className="space-y-3">
              {integration.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 h-5 w-5 rounded-full bg-muted text-foreground text-xs font-semibold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground leading-snug">{step.label}</p>
                    {step.detail && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.detail}</p>}
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
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
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
      await writeClipboardText(integration.snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy snippet: ", err);
    }
  };

  return (
    <div className="group flex min-h-24 items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-within:border-primary/40">
      <Button type="button" variant="ghost" aria-label={`Open ${integration.name} connection details`} onClick={onOpen} className="h-auto min-w-0 flex-1 justify-start gap-3 whitespace-normal p-0 text-left hover:bg-transparent">
        <div className="shrink-0">
          <BrandIcon integration={integration} size={40} />
        </div>
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-base font-bold text-foreground">{integration.name}</span>
            {isInstalled && (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                <Check className="h-3 w-3" /> Connected
              </span>
            )}
          </div>
          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground transition-colors group-hover:text-foreground/75 group-focus-within:text-foreground/75">
            {integration.tagline}
          </p>
        </div>
      </Button>

      <div className="flex shrink-0 items-center gap-2">
        {isOneClick && !isInstalled && (
          <Button
            type="button"
            size="sm"
            className="flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold"
            onClick={() => onInstall(integration.id)}
            disabled={installing === integration.id}
          >
            {installing === integration.id ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Installing…</>
            ) : (
              <><Zap className="h-3.5 w-3.5" /> Install</>
            )}
          </Button>
        )}
        {!isOneClick && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors ${
              copied
                ? "bg-emerald-600/12 text-emerald-700"
                : "text-primary hover:bg-primary/10"
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
          </Button>
        )}
      </div>
    </div>
  );
}

// -- Page Component --
export function ConnectionsPage({ mcpPort, mcpToken, plan }: ConnectionsPageProps) {
  const ipc = useIpc();

  const [statuses, setStatuses] = useState<Record<string, StatusType>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);

  const isPlusPro = plan.toLowerCase().includes("plus") || plan.toLowerCase().includes("pro");
  const INTEGRATIONS = useMemo(() => getIntegrations(mcpPort, mcpToken), [mcpPort, mcpToken]);
  const selectedIntegration = INTEGRATIONS.find((i) => i.id === selectedId) ?? null;
  const localPort = mcpPort ?? 3025;
  const encodedToken = encodeURIComponent(mcpToken ?? "<local-token>");
  const skillUrl = `http://localhost:${localPort}/skill.md?token=${encodedToken}`;
  const endpoint = `http://localhost:${localPort}/sse?token=${encodedToken}`;
  const connectionPrompt = `Connect this AI tool to Fikr through local MCP. Read ${skillUrl}, follow the setup instructions, then connect to ${endpoint}. Keep the local token private and never save it in project files or logs.`;
  const maskedToken = mcpToken ? "••••••••••••" : "<waiting-for-fikr>";
  const visibleSkillUrl = `http://localhost:${localPort}/skill.md?token=${maskedToken}`;
  const visibleEndpoint = `http://localhost:${localPort}/sse?token=${maskedToken}`;
  const visibleConnectionPrompt = `Connect this AI tool to Fikr through local MCP. Read ${visibleSkillUrl} and follow the setup instructions, then connect to ${visibleEndpoint}.`;

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

  const handleCopyPrompt = async () => {
    await writeClipboardText(connectionPrompt);
    setPromptCopied(true);
    window.setTimeout(() => setPromptCopied(false), 2_000);
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-background text-foreground" data-testid="connections-page">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 sm:px-5">
        <h1 className="fikr-toolbar-title">Connections</h1>
        {!isPlusPro && (
          <Button
            type="button"
            size="sm"
            className="mr-11 hidden h-8 shrink-0 px-3 text-xs sm:inline-flex lg:mr-0"
            onClick={() => window.open("https://fikr.one/pricing", "_blank")}
          >
            Upgrade
          </Button>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="fikr-page-frame">
        <header
          className="overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#0f766e_0%,#155e75_55%,#3730a3_100%)] p-6 text-white shadow-[0_20px_60px_rgba(15,118,110,0.18)] sm:p-8"
          aria-labelledby="connections-title"
        >
          <div className="grid gap-7 lg:grid-cols-[minmax(0,0.8fr)_minmax(360px,1.2fr)] lg:items-stretch">
            <div className="flex flex-col justify-center">
              <div className="mb-5 flex w-fit items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold text-white/90 ring-1 ring-inset ring-white/15">
                <Zap className="size-3.5" /> Local connection
              </div>
              <h2 id="connections-title" className="max-w-lg font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                Your knowledge, in every AI tool.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-white/75 sm:text-base">
                Connect Claude, Cursor, Windsurf, and more.
              </p>
            </div>

            <div className="flex min-w-0 flex-col rounded-2xl bg-black/18 p-4 ring-1 ring-inset ring-white/12 backdrop-blur-sm sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/65">Setup prompt</p>
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-white/65">
                  <Lock className="size-3" /> Private to this computer
                </span>
              </div>
              <p className="min-w-0 flex-1 break-words text-sm leading-6 text-white/90">
                {visibleConnectionPrompt}
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-white/60">
                  {mcpToken ? "Keep Fikr open while connected." : "Open Fikr Studio to enable copy."}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleCopyPrompt()}
                  disabled={!mcpToken}
                  title={mcpToken ? "Copy the complete local MCP prompt" : "Open Fikr Studio to load the local MCP token"}
                  className="w-full shrink-0 border-0 bg-white text-slate-950 hover:bg-white/90 sm:w-auto"
                >
                  {promptCopied ? <><Check className="size-4" /> Copied</> : <><Copy className="size-4" /> Copy prompt</>}
                </Button>
              </div>
            </div>
          </div>
        </header>

        <section className="pt-8" aria-labelledby="ai-apps-heading">
          <h2 id="ai-apps-heading" className="mb-5 text-xl font-bold tracking-tight">AI apps</h2>
          <div className="grid gap-3 md:grid-cols-2">
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
        </section>

        <section className="mt-8 rounded-2xl border border-border/70 bg-secondary/30 p-5 sm:p-6" aria-labelledby="remote-notes-heading">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div className="flex max-w-3xl items-start gap-3">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {isPlusPro ? <Webhook className="size-4" /> : <Lock className="size-4" />}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="remote-notes-heading" className="text-base font-semibold tracking-tight">Add notes while Fikr is closed</h2>
                  <span className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Plus / Pro</span>
                </div>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">Messenger Hooks receive notes without exposing local tools.</p>
              </div>
            </div>
            <Button
              type="button"
              variant={isPlusPro ? "default" : "outline"}
              onClick={() => window.open(isPlusPro ? "https://www.fikr.one/dashboard/settings" : "https://fikr.one/pricing", "_blank")}
              className="w-full shrink-0 sm:w-auto"
            >
              {isPlusPro ? "Open Messenger Hooks" : "View plans"} <ExternalLink className="size-4" />
            </Button>
          </div>
        </section>

        <IntegrationSheet
        integration={selectedIntegration}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        mcpPort={mcpPort}
        mcpToken={mcpToken}
        statuses={statuses}
        onInstall={handleInstall}
        onUninstall={handleUninstall}
        installing={installing}
        />
        </div>
      </div>
    </main>
  );
}
