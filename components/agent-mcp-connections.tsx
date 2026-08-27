"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ChevronLeft,
  Globe2,
  Loader2,
  LockKeyhole,
  Plus,
  Server,
  TerminalSquare,
  Trash2,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { actionableIpcError } from "@/lib/connection-display.mjs";
import { describeMcpConnection, parseMcpConnectionConfig } from "@/lib/mcp-connection-config.mjs";

interface AgentMcpConnection {
  name: string;
  transport: "streamable-http" | "sse" | "stdio";
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  cwd?: string;
  allowedTools: string[];
  enabled: boolean;
  hasPrivateConfig?: boolean;
}

interface DiscoveredTool {
  name: string;
  description: string;
}

const EMPTY_CONNECTION: AgentMcpConnection = {
  name: "",
  transport: "streamable-http",
  url: "",
  allowedTools: [],
  enabled: true,
};

const CONFIG_EXAMPLE = `{
  "mcpServers": {
    "research": {
      "url": "https://example.com/mcp"
    }
  }
}`;

export function AgentMcpConnections({ embedded = false }: { embedded?: boolean }) {
  const [connections, setConnections] = useState<AgentMcpConnection[]>([]);
  const [draft, setDraft] = useState<AgentMcpConnection>(EMPTY_CONNECTION);
  const [remoteName, setRemoteName] = useState("");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [configText, setConfigText] = useState("");
  const [addMode, setAddMode] = useState("config");
  const [tools, setTools] = useState<DiscoveredTool[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ipc = typeof window !== "undefined" ? (window as any).fikrStudio : null;

  const reload = useCallback(async () => {
    if (!ipc?.getAgentMcpConnections) return;
    const result = await ipc.getAgentMcpConnections();
    setConnections(Array.isArray(result) ? result : []);
  }, [ipc]);

  useEffect(() => {
    void reload().catch(() => setError("Couldn’t load Chat tool connections."));
  }, [reload]);

  const resetAddFlow = () => {
    setDraft(EMPTY_CONNECTION);
    setRemoteName("");
    setRemoteUrl("");
    setConfigText("");
    setAddMode("config");
    setTools([]);
    setError(null);
    setIsChecking(false);
    setIsSaving(false);
  };

  const setAddOpen = (open: boolean) => {
    setIsAdding(open);
    if (!open) resetAddFlow();
  };

  const connectAndDiscover = async () => {
    if (!ipc?.discoverAgentMcpTools) return;
    setError(null);

    let candidate: AgentMcpConnection;
    try {
      candidate = addMode === "config"
        ? parseMcpConnectionConfig(configText) as AgentMcpConnection
        : {
            ...EMPTY_CONNECTION,
            name: remoteName.trim(),
            url: remoteUrl.trim(),
          };
      if (!candidate.name || (candidate.transport !== "stdio" && !candidate.url)) {
        throw new Error("Add a name and server URL.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This MCP configuration is invalid.");
      return;
    }

    setIsChecking(true);
    try {
      const result = await ipc.discoverAgentMcpTools(candidate);
      const discovered = Array.isArray(result) ? result : [];
      setDraft({ ...candidate, allowedTools: [] });
      setTools(discovered);
      if (discovered.length === 0) setError("Connected, but this server did not advertise any tools.");
    } catch (caught) {
      setTools([]);
      setError(actionableIpcError(caught, "Couldn’t connect to this MCP server."));
    } finally {
      setIsChecking(false);
    }
  };

  const save = async () => {
    if (!ipc?.saveAgentMcpConnection || draft.allowedTools.length === 0) return;
    setError(null);
    setIsSaving(true);
    try {
      await ipc.saveAgentMcpConnection(draft);
      await reload();
      setAddOpen(false);
    } catch (caught) {
      setError(actionableIpcError(caught, "Couldn’t save this MCP connection."));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleEnabled = async (connection: AgentMcpConnection) => {
    if (!ipc?.setAgentMcpConnectionEnabled) return;
    try {
      await ipc.setAgentMcpConnectionEnabled(connection.name, !connection.enabled);
      await reload();
    } catch (caught) {
      setError(actionableIpcError(caught, "Couldn’t update this MCP connection."));
    }
  };

  const remove = async (name: string) => {
    if (!ipc?.removeAgentMcpConnection) return;
    try {
      await ipc.removeAgentMcpConnection(name);
      await reload();
    } catch (caught) {
      setError(actionableIpcError(caught, "Couldn’t remove this MCP connection."));
    }
  };

  const toggleTool = (name: string) => {
    setDraft((current) => ({
      ...current,
      allowedTools: current.allowedTools.includes(name)
        ? current.allowedTools.filter((toolName) => toolName !== name)
        : [...current.allowedTools, name],
    }));
  };

  const permissionStep = tools.length > 0;
  const allToolsSelected = permissionStep && draft.allowedTools.length === tools.length;

  return (
    <section aria-labelledby={embedded ? undefined : "chat-mcp-heading"} aria-label={embedded ? "Chat tool connections" : undefined}>
      <Dialog open={isAdding} onOpenChange={setAddOpen}>
      <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          {!embedded && (
            <h2 id="chat-mcp-heading" className="flex items-center gap-2 font-display text-lg font-medium text-foreground">
              <Bot className="size-4 text-muted-foreground" />
              Chat tools
            </h2>
          )}
          <p className={`${embedded ? "" : "mt-1"} text-sm leading-6 text-muted-foreground`}>
            Connect tools that Fikr can use while you chat.
          </p>
        </div>
        <DialogTrigger asChild>
          <Button type="button" size="sm" className="w-full shrink-0 sm:w-auto">
            <Plus className="size-4" />
            Add MCP server
          </Button>
        </DialogTrigger>
      </div>

      {connections.length === 0 ? (
        <Card className="mt-6 gap-0 border-dashed bg-muted/20 py-0 shadow-none">
          <CardContent className="flex min-h-44 flex-col items-center justify-center px-6 py-8 text-center">
            <span className="grid size-10 place-items-center rounded-xl border bg-background text-muted-foreground shadow-xs">
              <Wrench className="size-[18px]" />
            </span>
            <p className="mt-4 text-sm font-semibold text-foreground">No Chat tools connected</p>
            <p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">
              Add an MCP server, review its tools, and choose what Fikr may use.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border bg-card">
          {connections.map((connection, index) => (
            <div
              key={connection.name}
              className={`flex min-h-[68px] items-center gap-3 px-4 py-3 ${index > 0 ? "border-t" : ""}`}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                {connection.transport === "stdio" ? <TerminalSquare className="size-4" /> : <Globe2 className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{connection.name}</p>
                  {connection.hasPrivateConfig && <LockKeyhole className="size-3 text-muted-foreground" aria-label="Private configuration stored locally" />}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {connection.allowedTools.length} {connection.allowedTools.length === 1 ? "tool" : "tools"} · {describeMcpConnection(connection)}
                </p>
              </div>
              <Switch
                checked={connection.enabled}
                onCheckedChange={() => void toggleEnabled(connection)}
                aria-label={`${connection.enabled ? "Disable" : "Enable"} ${connection.name}`}
              />
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => void remove(connection.name)}
                aria-label={`Remove ${connection.name}`}
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {!isAdding && error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}

        <DialogContent className="max-h-[min(780px,calc(100dvh-2rem))] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{permissionStep ? "Choose what Fikr can use" : "Add MCP server"}</DialogTitle>
            <DialogDescription>
              {permissionStep
                ? "Only the tools you select will be available in Chat."
                : "Paste the config from your MCP provider or connect a hosted server."}
            </DialogDescription>
          </DialogHeader>

          {permissionStep ? (
            <div className="min-h-0 space-y-4">
              <div className="rounded-lg border bg-muted/25 p-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-background text-muted-foreground">
                    {draft.transport === "stdio" ? <TerminalSquare className="size-4" /> : <Server className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{draft.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{describeMcpConnection(draft)}</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-3.5" /> Connected
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Available tools</p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setDraft((current) => ({
                    ...current,
                    allowedTools: allToolsSelected ? [] : tools.map((tool) => tool.name),
                  }))}
                  className="h-8 px-2 text-xs"
                >
                  {allToolsSelected ? "Clear" : "Select all"}
                </Button>
              </div>

              <ScrollArea className="h-[min(330px,38dvh)]">
                <div className="space-y-1 pr-3">
                  {tools.map((candidate) => {
                    const checked = draft.allowedTools.includes(candidate.name);
                    return (
                      <label key={candidate.name} className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-3 hover:bg-muted/60">
                        <Checkbox checked={checked} onCheckedChange={() => toggleTool(candidate.name)} aria-label={`Allow ${candidate.name}`} className="mt-0.5" />
                        <span className="min-w-0">
                          <span className="block font-mono text-xs font-medium text-foreground">{candidate.name}</span>
                          {candidate.description && <span className="mt-1 block text-xs leading-5 text-muted-foreground">{candidate.description}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div>
              <Tabs className="gap-0" value={addMode} onValueChange={(value) => { setAddMode(value); setError(null); }}>
                <TabsList aria-label="Connection type" className="grid h-10 w-full grid-cols-2 rounded-lg bg-muted/60 p-1">
                  <TabsTrigger className="h-8 w-full data-[state=active]:bg-background data-[state=active]:shadow-xs" value="config">Paste config</TabsTrigger>
                  <TabsTrigger className="h-8 w-full data-[state=active]:bg-background data-[state=active]:shadow-xs" value="remote">Hosted server</TabsTrigger>
                </TabsList>
                <TabsContent value="config" className="mt-5 min-h-[296px] space-y-3">
                  <div>
                    <label htmlFor="mcp-config" className="text-sm font-medium text-foreground">MCP configuration</label>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Paste one `mcpServers` entry from the provider’s setup guide.</p>
                  </div>
                  <Textarea
                    id="mcp-config"
                    value={configText}
                    onChange={(event) => setConfigText(event.target.value)}
                    placeholder={CONFIG_EXAMPLE}
                    spellCheck={false}
                    className="min-h-52 resize-none font-mono text-xs leading-5"
                  />
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <LockKeyhole className="size-3.5" /> Local commands and private values stay on this Mac.
                  </p>
                </TabsContent>
                <TabsContent value="remote" className="mt-5 min-h-[296px] space-y-4">
                  <div>
                    <label htmlFor="mcp-name" className="text-sm font-medium text-foreground">Name</label>
                    <Input id="mcp-name" value={remoteName} onChange={(event) => setRemoteName(event.target.value)} placeholder="Research" className="mt-2" />
                  </div>
                  <div>
                    <label htmlFor="mcp-url" className="text-sm font-medium text-foreground">Server URL</label>
                    <Input id="mcp-url" value={remoteUrl} onChange={(event) => setRemoteUrl(event.target.value)} placeholder="https://example.com/mcp" className="mt-2" />
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">Use HTTPS, or a localhost URL for a server running on this Mac.</p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {error && <p role="alert" className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

          <DialogFooter>
            {permissionStep ? (
              <>
                <Button type="button" variant="ghost" onClick={() => { setTools([]); setDraft(EMPTY_CONNECTION); setError(null); }} className="mr-auto">
                  <ChevronLeft className="size-4" /> Back
                </Button>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="button" onClick={() => void save()} disabled={isSaving || draft.allowedTools.length === 0}>
                  {isSaving && <Loader2 className="size-4 animate-spin" />}
                  Add {draft.allowedTools.length || ""} {draft.allowedTools.length === 1 ? "tool" : "tools"}
                </Button>
              </>
            ) : (
              <>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  type="button"
                  onClick={() => void connectAndDiscover()}
                  disabled={isChecking || (addMode === "config" ? !configText.trim() : !remoteName.trim() || !remoteUrl.trim())}
                >
                  {isChecking && <Loader2 className="size-4 animate-spin" />}
                  Connect and review
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
