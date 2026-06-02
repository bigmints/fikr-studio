"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Check, Copy, ExternalLink, Loader2, Plug, Zap, AlertTriangle, RefreshCw, Wrench, Sparkles, Lock } from "lucide-react";
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
  {
    id: "linear",
    name: "Linear",
    tagline: "Auto-capture notes when issues are created or updated.",
    description: "When issues are created, updated, or completed in Linear, Fikr automatically captures a note. Track your sprint work alongside your thinking.",
    iconSrc: "/brand-icons/linear.svg",
    iconBg: "#5E6AD2", iconLetter: "L",
    category: "Webhooks",
    connectionType: "copy-endpoint",
    requiresPlan: "plus",
    steps: [
      { label: "Copy your relay endpoint", detail: "Your unique cloud webhook URL is shown above. Copy it." },
      { label: "Open Linear → Settings → API → Webhooks", detail: "Click New webhook → paste your endpoint URL." },
      { label: "Select events", detail: "Enable: Issues (Created, Updated), Comments (Created)." },
    ],
    snippet: "https://fikr.one/api/relay/webhook/linear",
    snippetLang: "text",
    docsUrl: "https://developers.linear.app/docs/graphql/webhooks",
    primaryActionLabel: "Copy Endpoint",
  },
  {
    id: "vercel",
    name: "Vercel",
    tagline: "Get notified when deployments succeed or fail.",
    description: "Get notified in Fikr when deployments succeed or fail. Auto-capture deploy logs alongside your project notes.",
    iconSrc: "/brand-icons/vercel.svg",
    iconBg: "#000000", iconLetter: "V",
    category: "Webhooks",
    connectionType: "copy-endpoint",
    requiresPlan: "plus",
    steps: [
      { label: "Copy your relay endpoint", detail: "Your unique cloud webhook URL is shown above. Copy it." },
      { label: "Open Vercel → Project Settings → Webhooks", detail: "Click Add Webhook → paste the URL." },
      { label: "Select events", detail: "Enable: deployment.succeeded, deployment.error, deployment.cancelled." },
    ],
    snippet: "https://fikr.one/api/relay/webhook/vercel",
    snippetLang: "text",
    docsUrl: "https://vercel.com/docs/observability/webhooks-overview",
    primaryActionLabel: "Copy Endpoint",
  },
  {
    id: "slack",
    name: "Slack",
    tagline: "Post Fikr summaries directly to a Slack channel.",
    description: "Post Fikr summaries or insight highlights directly to a Slack channel. Also receive Slack messages as Fikr notes via slash command.",
    iconEmoji: "💬",
    iconBg: "#4A154B", iconLetter: "S",
    category: "Webhooks",
    connectionType: "paste-url",
    requiresPlan: "plus",
    steps: [
      { label: "Create a Slack app", detail: "Go to api.slack.com/apps → Create New App → From Scratch." },
      { label: "Enable Incoming Webhooks", detail: "Under Features → Incoming Webhooks → toggle ON → Add New Webhook to Workspace." },
      { label: "Paste your webhook URL into Fikr", detail: "Copy the URL from Slack and paste it in the field below." },
    ],
    snippet: 'POST https://hooks.slack.com/services/T.../B.../XXXX\nContent-Type: application/json\n\n{"text": "New Fikr insight: Your weekly review is ready."}',
    snippetLang: "text",
    docsUrl: "https://api.slack.com/messaging/webhooks",
    primaryActionLabel: "Paste URL",
  },
  {
    id: "discord",
    name: "Discord",
    tagline: "Post Fikr notes or alerts to a Discord channel.",
    description: "Post Fikr notes or alerts to a Discord channel. Useful for team shared-brain setups.",
    iconSrc: "/brand-icons/discord.svg",
    iconBg: "#5865F2", iconLetter: "D",
    category: "Webhooks",
    connectionType: "paste-url",
    requiresPlan: "plus",
    steps: [
      { label: "Open Discord Server Settings", detail: "Go to Integrations → Webhooks → New Webhook." },
      { label: "Copy the webhook URL", detail: "Format: https://discord.com/api/webhooks/{id}/{token}" },
      { label: "Paste your webhook URL into Fikr", detail: "Paste it in the field below to connect." },
    ],
    snippet: 'POST https://discord.com/api/webhooks/{id}/{token}\nContent-Type: application/json\n\n{"content": "New Fikr note captured."}',
    snippetLang: "text",
    docsUrl: "https://discord.com/developers/docs/resources/webhook",
    primaryActionLabel: "Paste URL",
  },
  {
    id: "telegram",
    name: "Telegram",
    tagline: "Send Fikr notes or reminders to yourself via Telegram.",
    description: "Send Fikr notes or reminders to yourself via Telegram. The bot can also receive messages and create notes.",
    iconSrc: "/brand-icons/telegram.svg",
    iconBg: "#0088CC", iconLetter: "T",
    category: "Webhooks",
    connectionType: "paste-url",
    requiresPlan: "plus",
    steps: [
      { label: "Create a bot via @BotFather", detail: "Message @BotFather → /newbot → follow prompts → copy your token." },
      { label: "Register the webhook with your relay URL", detail: "POST https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://fikr.one/api/relay/webhook/telegram" },
      { label: "Paste your bot token into Fikr", detail: "Paste the token in the field below." },
    ],
    snippet: "POST https://api.telegram.org/bot{TOKEN}/setWebhook\n?url=https://fikr.one/api/relay/webhook/telegram",
    snippetLang: "text",
    docsUrl: "https://core.telegram.org/bots/api#setwebhook",
    primaryActionLabel: "Paste URL",
  },
  {
    id: "sentry",
    name: "Sentry",
    tagline: "Capture error alerts as notes alongside your canvas.",
    description: "When an error or alert fires in Sentry, Fikr captures a note with the error context. Track production issues alongside your project canvas.",
    iconSrc: "/brand-icons/sentry.svg",
    iconBg: "#362D59", iconLetter: "S",
    category: "Webhooks",
    connectionType: "copy-endpoint",
    requiresPlan: "plus",
    steps: [
      { label: "Copy your relay endpoint", detail: "Your unique cloud webhook URL is shown above. Copy it." },
      { label: "Open Sentry → Settings → Developer Settings → Internal Integrations", detail: "Create New Integration → Name it 'Fikr Studio'." },
      { label: "Paste endpoint under Webhooks", detail: "Select events: issue (created, resolved), error_alert, metric_alert." },
    ],
    snippet: "https://fikr.one/api/relay/webhook/sentry",
    snippetLang: "text",
    docsUrl: "https://docs.sentry.io/organization/integrations/integration-platform/webhooks/",
    primaryActionLabel: "Copy Endpoint",
  },
  {
    id: "n8n",
    name: "n8n",
    tagline: "Build automations that read from or write to Fikr.",
    description: "Build automation workflows that read from or write to Fikr. n8n's HTTP Request node can POST to Fikr's cloud relay endpoint on any trigger.",
    iconSrc: "/brand-icons/n8n-color.svg",
    iconBg: "#EA4B71", iconLetter: "n",
    category: "Webhooks",
    connectionType: "copy-endpoint",
    requiresPlan: "plus",
    steps: [
      { label: "Create a workflow in n8n", detail: "Add an HTTP Request node." },
      { label: "Set method to POST", detail: "URL: https://fikr.one/api/relay/webhook/n8n (add Authorization: Bearer header)" },
      { label: "Set body", detail: '{"event": "...", "data": {...}}' },
    ],
    snippet: "https://fikr.one/api/relay/webhook/n8n",
    snippetLang: "text",
    docsUrl: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/",
    primaryActionLabel: "Copy Endpoint",
  },
  {
    id: "zapier",
    name: "Zapier",
    tagline: "Connect Fikr to thousands of apps through Zapier.",
    description: "Connect Fikr to thousands of apps through Zapier. Use 'Send Webhook' action to POST events to Fikr.",
    iconSrc: "/brand-icons/zapier-color.svg",
    iconBg: "#FF4A00", iconLetter: "Z",
    category: "Automation & REST",
    connectionType: "copy-endpoint",
    requiresPlan: "plus",
    steps: [
      { label: "Create a new Zap", detail: "Choose your trigger (e.g. New row in Google Sheets)." },
      { label: "Add action: Webhooks by Zapier → POST", detail: "URL: https://fikr.one/api/relay/webhook/zapier (add Authorization: Bearer header)" },
      { label: "Set payload", detail: '{"source": "zapier", "content": "...", "title": "..."}' },
    ],
    snippet: "https://fikr.one/api/relay/webhook/zapier",
    snippetLang: "text",
    docsUrl: "https://zapier.com/apps/webhook/integrations",
    primaryActionLabel: "Copy Endpoint",
  },
  {
    id: "notion",
    name: "Notion",
    tagline: "Read Notion pages and databases from your AI client.",
    description: "Read Notion pages and databases from your AI client via the official Notion API. Keep your Notion knowledge base in sync with your Fikr canvas.",
    iconSrc: "/brand-icons/notion.svg",
    iconBg: "#000000", iconLetter: "N",
    category: "Automation & REST",
    connectionType: "rest-api",
    requiresPlan: "plus",
    steps: [
      { label: "Create a Notion integration", detail: "Go to notion.so/my-integrations → New integration → get your Integration Token." },
      { label: "Share your database", detail: "Page menu → Connect → Fikr Studio." },
      { label: "Paste your token into Fikr", detail: "Fikr routes it through the cloud relay to Notion's API." },
    ],
    snippet: "GET https://api.notion.com/v1/databases/{id}/query\nAuthorization: Bearer {your_token}\nNotion-Version: 2022-06-28",
    snippetLang: "text",
    docsUrl: "https://developers.notion.com/reference/intro",
    primaryActionLabel: "Paste Token",
  },
  {
    id: "todoist",
    name: "Todoist",
    tagline: "Capture completed tasks as Fikr notes automatically.",
    description: "When Todoist tasks complete, Fikr captures a note. Or: trigger task creation from Fikr insights.",
    iconSrc: "/brand-icons/todoist.svg",
    iconBg: "#DB4035", iconLetter: "T",
    category: "Automation & REST",
    connectionType: "copy-endpoint",
    requiresPlan: "plus",
    steps: [
      { label: "Get your Todoist API token", detail: "Settings → Integrations → Developer → copy API token." },
      { label: "Register the webhook", detail: 'POST https://api.todoist.com/api/v1/webhooks with url: https://fikr.one/api/relay/webhook/todoist' },
      { label: "Copy endpoint below", detail: "Use this URL when registering the webhook." },
    ],
    snippet: "https://fikr.one/api/relay/webhook/todoist",
    snippetLang: "text",
    docsUrl: "https://developer.todoist.com/sync/v9/#webhooks",
    primaryActionLabel: "Copy Endpoint",
  },
  {
    id: "make",
    name: "Make",
    tagline: "Use Make scenarios to automate Fikr note creation.",
    description: "Use Make's HTTP module to POST to Fikr as part of any multi-step automation scenario.",
    iconSrc: "/brand-icons/make.svg",
    iconBg: "#6D00CC", iconLetter: "M",
    category: "Automation & REST",
    connectionType: "copy-endpoint",
    requiresPlan: "plus",
    steps: [
      { label: "Create a scenario in Make", detail: "Add HTTP → Make a Request module." },
      { label: "Set method to POST", detail: "URL: https://fikr.one/api/relay/webhook/make (add Authorization: Bearer header)" },
      { label: "Set body", detail: '{"trigger": "...", "payload": {...}}' },
    ],
    snippet: "https://fikr.one/api/relay/webhook/make",
    snippetLang: "text",
    docsUrl: "https://www.make.com/en/integrations/http",
    primaryActionLabel: "Copy Endpoint",
  },
  ];
};

const CATEGORIES = ["All", "MCP Clients", "Webhooks", "Automation & REST"];

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

function TypeBadge({ type }: { type: ConnectionType }) {
  const map: Record<ConnectionType, { label: string; class: string }> = {
    "1-click":       { label: "⚡ 1-Click",     class: "bg-primary/10 text-primary border-primary/25 dark:bg-primary/15" },
    "copy-config":   { label: "Config",         class: "bg-blue-500/10 text-blue-600 border-blue-400/25 dark:text-blue-400" },
    "copy-endpoint": { label: "Webhook",        class: "bg-violet-500/10 text-violet-600 border-violet-400/25 dark:text-violet-400" },
    "paste-url":     { label: "Paste URL",      class: "bg-amber-500/10 text-amber-700 border-amber-400/25 dark:text-amber-400" },
    "rest-api":      { label: "REST",           class: "bg-emerald-500/10 text-emerald-700 border-emerald-400/25 dark:text-emerald-400" },
  };
  const { label, class: cls } = map[type];
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${cls}`}>
      {label}
    </span>
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

  const accentColor = isInstalled ? "#10b981" : integration.iconBg;

  return (
    <div
      className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all duration-200 cursor-pointer group relative overflow-hidden
        ${ isInstalled
          ? "border-emerald-500/25 bg-gradient-to-r from-emerald-500/[0.04] to-transparent shadow-sm"
          : "border-border/30 bg-card hover:border-border/50 hover:shadow-md dark:hover:bg-muted/10"
        }`}
      style={{ boxShadow: isInstalled ? `0 1px 12px ${accentColor}18` : undefined }}
      onClick={onOpen}
    >
      {/* Subtle left accent bar */}
      <div
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full opacity-60"
        style={{ background: accentColor }}
      />

      <div className="pl-2">
        <BrandIcon integration={integration} size={42} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-bold text-[13.5px] text-foreground tracking-tight">{integration.name}</span>
          <StatusDot status={status} />
        </div>
        <p className="text-[12px] text-muted-foreground leading-snug truncate mb-1.5">{integration.tagline}</p>
        <TypeBadge type={integration.connectionType} />
      </div>

      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        {isOneClick && !isInstalled && (
          <Button
            size="sm"
            className="font-bold h-8 px-4 text-[12px] shadow-sm"
            style={{ boxShadow: `0 2px 8px ${integration.iconBg}35` }}
            onClick={() => onInstall(integration.id)}
            disabled={installing === integration.id}
          >
            {installing === integration.id
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Zap className="h-3.5 w-3.5" />
            }
            {installing === integration.id ? "Installing…" : "Install"}
          </Button>
        )}
        {isInstalled && (
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
            <Check className="h-3 w-3" /> Connected
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-[12px] text-muted-foreground group-hover:text-foreground h-8"
          onClick={onOpen}
        >
          View guide
        </Button>
      </div>
    </div>
  );
}

// -- Page Component --
export function ConnectionsPage({ mcpPort, plan, relayApiKey }: ConnectionsPageProps) {
  const ipc = useIpc();
  const isPlusPro = plan.toLowerCase().includes("plus") || plan.toLowerCase().includes("pro");
  const [activeCategory, setActiveCategory] = useState("All");
  const [statuses, setStatuses] = useState<Record<string, StatusType>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);

  const INTEGRATIONS = useMemo(() => getIntegrations(mcpPort), [mcpPort]);
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

  const visible = activeCategory === "All"
    ? INTEGRATIONS
    : INTEGRATIONS.filter((i) => i.category === activeCategory);

  const grouped = CATEGORIES.slice(1).reduce<Record<string, Integration[]>>((acc, cat) => {
    const items = visible.filter((i) => i.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">

      {/* Header */}
      <div className="px-8 pt-10 pb-6 border-b border-border/10 shrink-0">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-2xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 70%, #7c3aed) 100%)", boxShadow: "0 4px 16px color-mix(in srgb, var(--primary) 35%, transparent)" }}>
                <Plug className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">Connections</h1>
            </div>
            <p className="text-[13px] text-muted-foreground max-w-lg leading-relaxed">
              Connect Fikr Studio to your AI clients, dev tools, and automation platforms.
            </p>
          </div>
          <div className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl border text-[12px] font-bold ${
            mcpPort
              ? "border-emerald-500/30 bg-emerald-500/8 text-emerald-700 dark:text-emerald-400"
              : "border-border/30 bg-muted/20 text-muted-foreground"
          }`}>
            <span className={`h-2 w-2 rounded-full ${mcpPort ? "bg-emerald-500 animate-pulse" : "bg-zinc-300 dark:bg-zinc-600"}`} />
            {mcpPort ? `MCP · :${mcpPort}` : "MCP offline"}
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {CATEGORIES.map((cat) => {
            const catIntegrations = INTEGRATIONS.filter((i) => i.category === cat);
            const count = cat === "All" ? INTEGRATIONS.length : catIntegrations.length;
            const isActive = activeCategory === cat;
            const catLocked = cat !== "All" && catIntegrations.every(i => i.requiresPlan === "plus") && !isPlusPro;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`h-8 px-4 rounded-full text-[12px] font-semibold transition-all border flex items-center gap-1.5 ${
                  isActive
                    ? "bg-foreground text-background border-transparent shadow-sm"
                    : "bg-transparent text-muted-foreground hover:text-foreground border-border/30 hover:border-border/60 hover:bg-muted/30"
                }`}
              >
                {catLocked && <Lock className="h-2.5 w-2.5 opacity-60" />}
                {cat}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  isActive ? "bg-white/20" : "bg-muted/50 text-muted-foreground"
                }`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Integration list */}
      <div className="px-8 py-6 space-y-8 max-w-3xl">
        {activeCategory === "All"
          ? Object.entries(grouped).map(([cat, items]) => {
              const catNeedsPlan = items.every(i => i.requiresPlan === "plus");
              const catLocked = catNeedsPlan && !isPlusPro;
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary opacity-60" />
                    <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{cat}</h2>
                    {catLocked && (
                      <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                        <Lock className="h-2.5 w-2.5" /> Plus
                      </span>
                    )}
                  </div>
                  {catLocked ? (
                    <UpgradeWall category={cat} integrations={items} />
                  ) : (
                    <div className="space-y-2">
                      {items.map((integration) => (
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
                  )}
                </div>
              );
            })
          : (
            <div className="space-y-2">
              {visible.map((integration) => (
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
          )
        }
      </div>

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
