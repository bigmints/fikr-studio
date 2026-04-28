"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Settings,
  Key,
  Eye,
  EyeOff,
  ChevronDown,
  Check,
  Globe,
  Copy,
  Cloud,
  Terminal,
  Save,
} from "lucide-react";
import {
  AI_PROVIDER_PRESETS,
  getModelsForProvider,
  getPreset,
  type AISettings,
  type AIProvider,
} from "@/lib/ai-settings";
import {
  signInWithCustomToken,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { collection, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aiSettings: AISettings;
  onUpdateAISettings: (patch: Partial<AISettings>) => void;
  mcpPort?: number | null;
}

export function SettingsModal({
  open,
  onOpenChange,
  aiSettings,
  onUpdateAISettings,
  mcpPort,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState("provider");
  const [showKey, setShowKey] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);
  const [draft, setDraft] = useState<AISettings>(aiSettings);
  const [user, setUser] = useState<User | null>(null);
  const [userPlan, setUserPlan] = useState<string>("Free");
  const [relayApiKey, setRelayApiKey] = useState<string>("");
  const [loginError, setLoginError] = useState("");

  // Sync draft when modal opens
  useEffect(() => {
    if (open) setDraft(aiSettings);
  }, [open, aiSettings]);

  // Firebase Auth State
  useEffect(() => {
    const auth = getFirebaseAuth();
    const db = getFirebaseDb();

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        onSnapshot(doc(db, "users", currentUser.uid), async (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setUserPlan(data.plan || "Free");
            if (!data.relayApiKey) {
              const newKey = "fp_" + crypto.randomUUID().replace(/-/g, "");
              await updateDoc(doc(db, "users", currentUser.uid), {
                relayApiKey: newKey,
              });
              setRelayApiKey(newKey);
            } else {
              setRelayApiKey(data.relayApiKey);
            }
          }
        });
      } else {
        setUserPlan("Free");
        setRelayApiKey("");
      }
    });

    // @ts-ignore
    const unsubscribeIpc = window.fikrpad?.onExternalEvent?.((eventData) => {
      if (eventData.type === "auth-token" && eventData.payload?.token) {
        signInWithCustomToken(auth, eventData.payload.token).catch((err) =>
          setLoginError(err.message),
        );
      }
    });

    return () => {
      unsubscribeAuth();
      // @ts-ignore
      if (unsubscribeIpc) unsubscribeIpc();
    };
  }, []);

  const handleSave = () => {
    const trimmedKey = draft.apiKey.trim();
    const providerKeys: Partial<Record<AIProvider, string>> = {
      ...(draft.providerKeys ?? {}),
      [draft.provider]: trimmedKey,
    };
    onUpdateAISettings({ ...draft, apiKey: trimmedKey, providerKeys });
    onOpenChange(false);
  };

  const currentPreset = getPreset(draft.provider);
  const models = getModelsForProvider(draft.provider);
  const selectedModel =
    models.find((m) => m.id === draft.modelId) || models[0] || undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-background border-border/50 max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 font-mono text-[15px] uppercase text-primary">
            <Settings className="h-4 w-4" />
            Settings
          </DialogTitle>
          <DialogDescription className="font-mono text-xs text-muted-foreground">
            Configure AI provider, cloud relay, and MCP connections.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Bar */}
        <div className="flex flex-row border-b border-border/30 px-6 gap-1 shrink-0">
          <button
            onClick={() => setActiveTab("provider")}
            className={`flex items-center gap-1.5 px-3 h-8 text-xs font-mono uppercase tracking-tight transition-colors rounded-t-sm ${
              activeTab === "provider"
                ? "border-b border-foreground/20 text-foreground bg-muted/50"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            <Key className="h-3 w-3" />
            Provider
          </button>
          <button
            onClick={() => setActiveTab("cloud")}
            className={`flex items-center gap-1.5 px-3 h-8 text-xs font-mono uppercase tracking-tight transition-colors rounded-t-sm ${
              activeTab === "cloud"
                ? "border-b border-foreground/20 text-foreground bg-muted/50"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            <Cloud className="h-3 w-3" />
            Fikr Cloud
          </button>
          <button
            onClick={() => setActiveTab("mcp")}
            className={`flex items-center gap-1.5 px-3 h-8 text-xs font-mono uppercase tracking-tight transition-colors rounded-t-sm ${
              activeTab === "mcp"
                ? "border-b border-foreground/20 text-foreground bg-muted/50"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            <Terminal className="h-3 w-3" />
            MCP
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
          {/* ── Provider Tab ── */}
          {activeTab === "provider" && (
            <div className="flex flex-col gap-4">
              {/* Provider Selector */}
              <div className="flex flex-col gap-2">
                <label className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                  Provider
                </label>
                <div className="relative">
                  <button
                    onClick={() => setProviderOpen((v) => !v)}
                    className="flex w-full items-center justify-between rounded-md border border-border/40 bg-muted/30 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-mono text-[13px] font-bold text-foreground">
                      {currentPreset.label}
                    </span>
                    <ChevronDown
                      className={`h-3 w-3 text-muted-foreground transition-transform ${providerOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {providerOpen && (
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 overflow-hidden rounded-md border border-border/40 bg-popover shadow-xl">
                      {AI_PROVIDER_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => {
                            const newModels = getModelsForProvider(preset.id);
                            setDraft((d) => ({
                              ...d,
                              provider: preset.id,
                              modelId: newModels[0]?.id ?? d.modelId,
                              webGrounding: d.webGrounding,
                              customBaseUrl: "",
                              apiKey: d.providerKeys?.[preset.id] ?? "",
                            }));
                            setProviderOpen(false);
                          }}
                          className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left hover:bg-accent/50 transition-colors"
                        >
                          <div
                            className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                              draft.provider === preset.id
                                ? "border-primary bg-primary/20"
                                : "border-border/40"
                            }`}
                          >
                            {draft.provider === preset.id && (
                              <Check className="h-2.5 w-2.5 text-primary" />
                            )}
                          </div>
                          <span className="font-mono text-[12px] font-bold text-foreground">
                            {preset.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* API Key */}
              <div className="flex flex-col gap-2">
                <label className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                  API Key
                </label>
                <div className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/30 px-3 py-2.5 focus-within:border-primary/50 transition-colors">
                  <Key className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <input
                    type="text"
                    value={draft.apiKey}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, apiKey: e.target.value }))
                    }
                    placeholder={currentPreset.keyPlaceholder || "Your API key"}
                    className="flex-1 bg-transparent font-mono text-[13px] text-foreground outline-none placeholder:text-muted-foreground/50"
                    style={
                      showKey
                        ? undefined
                        : ({ WebkitTextSecurity: "disc" } as never)
                    }
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    onClick={() => setShowKey((v) => !v)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showKey ? (
                      <EyeOff className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                  </button>
                </div>
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                  Stored locally. Never sent to a server.{" "}
                  {currentPreset.keyUrl && currentPreset.keyUrl !== "#" && (
                    <a
                      href={currentPreset.keyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline hover:brightness-125 transition-all"
                    >
                      Get a key →
                    </a>
                  )}
                </p>
              </div>

              {/* Custom Base URL */}
              <div className="flex flex-col gap-2">
                <label className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                  Custom Base URL
                </label>
                <div className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/30 px-3 py-2.5 focus-within:border-primary/50 transition-colors">
                  <input
                    type="text"
                    value={draft.customBaseUrl ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, customBaseUrl: e.target.value }))
                    }
                    placeholder="Optional — for local/self-hosted endpoints"
                    className="flex-1 bg-transparent font-mono text-[13px] text-foreground outline-none placeholder:text-muted-foreground/50"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                  Override the provider URL. Useful for Ollama, LM Studio, vLLM,
                  or other OpenAI-compatible endpoints.
                </p>
              </div>

              {/* Model Selector */}
              <div className="flex flex-col gap-2">
                <label className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                  Model
                </label>
                {(models?.length || 0) === 0 ? (
                  <div className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/30 px-3 py-2.5">
                    <input
                      type="text"
                      value={draft.modelId}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, modelId: e.target.value }))
                      }
                      placeholder="e.g. gpt-4o, claude-3-opus-20240229"
                      className="flex-1 bg-transparent font-mono text-[13px] text-foreground outline-none placeholder:text-muted-foreground/50"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <button
                      onClick={() => setModelOpen((v) => !v)}
                      className="flex w-full items-center justify-between rounded-md border border-border/40 bg-muted/30 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <div className="font-mono text-[13px] font-bold text-foreground">
                          {selectedModel?.label ?? draft.modelId}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground mt-0.5">
                          {selectedModel?.description ?? "Custom model ID"}
                        </div>
                      </div>
                      <ChevronDown
                        className={`h-3 w-3 text-muted-foreground transition-transform ${modelOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {modelOpen && (
                      <div className="absolute top-full left-0 right-0 z-20 mt-1 overflow-hidden rounded-md border border-border/40 bg-popover shadow-xl max-h-48 overflow-y-auto">
                        {models.map((model) => (
                          <button
                            key={model.id}
                            onClick={() => {
                              setDraft((d) => ({
                                ...d,
                                modelId: model.id,
                                webGrounding: model.supportsGrounding
                                  ? d.webGrounding
                                  : false,
                              }));
                              setModelOpen(false);
                            }}
                            className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left hover:bg-accent/50 transition-colors"
                          >
                            <div
                              className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                                draft.modelId === model.id
                                  ? "border-primary bg-primary/20"
                                  : "border-border/40"
                              }`}
                            >
                              {draft.modelId === model.id && (
                                <Check className="h-2.5 w-2.5 text-primary" />
                              )}
                            </div>
                            <div>
                              <div className="font-mono text-[12px] font-bold text-foreground">
                                {model.label}
                              </div>
                              <div className="font-mono text-xs text-muted-foreground">
                                {model.description}
                              </div>
                            </div>
                            {model.supportsGrounding &&
                              (draft.provider === "openrouter" ||
                                draft.provider === "openai") && (
                                <Globe className="ml-auto h-3 w-3 shrink-0 text-primary/50" />
                              )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Web Grounding */}
              {(draft.provider === "openrouter" ||
                draft.provider === "openai") &&
                selectedModel && (
                  <div className="flex items-start justify-between gap-3 rounded-md border border-border/30 bg-muted/20 px-3 py-3">
                    <div className="flex items-start gap-2">
                      <Globe className="h-3.5 w-3.5 mt-0.5 text-primary/60 shrink-0" />
                      <div>
                        <div className="font-mono text-[13px] font-bold text-foreground">
                          Web Grounding
                        </div>
                        <div className="font-mono text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {selectedModel.supportsGrounding
                            ? draft.provider === "openai"
                              ? `Uses ${selectedModel.groundingModelId ?? "search-preview"} for live web access`
                              : "Adds :online for live search"
                            : "Not available for this model"}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        selectedModel.supportsGrounding &&
                        setDraft((d) => ({
                          ...d,
                          webGrounding: !d.webGrounding,
                        }))
                      }
                      disabled={!selectedModel.supportsGrounding}
                      className={`relative shrink-0 h-5 w-9 rounded-full transition-all duration-200 ${
                        draft.webGrounding && selectedModel.supportsGrounding
                          ? "bg-primary"
                          : "bg-muted-foreground/20"
                      } disabled:opacity-30 disabled:cursor-not-allowed`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-all duration-200 ${
                          draft.webGrounding && selectedModel.supportsGrounding
                            ? "left-5"
                            : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>
                )}

              {/* API Status */}
              <div
                className={`flex items-center gap-2 rounded-md px-3 py-2.5 font-mono text-xs ${
                  draft.apiKey || draft.provider === "custom"
                    ? "bg-primary/10 border border-primary/20 text-primary"
                    : "bg-muted/30 border border-border/30 text-muted-foreground"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${draft.apiKey || draft.provider === "custom" ? "bg-primary animate-pulse" : "bg-muted-foreground/30"}`}
                />
                {draft.apiKey
                  ? `${currentPreset.label} — API key configured`
                  : draft.provider === "custom"
                    ? "Custom endpoint configured"
                    : "No API key — AI disabled"}
              </div>
            </div>
          )}

          {/* ── Fikr Cloud Tab ── */}
          {activeTab === "cloud" && (
            <div className="flex flex-col gap-4">
              {user ? (
                <>
                  {/* User Info Card */}
                  <div className="rounded-md border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Cloud className="h-4 w-4 text-primary" />
                      <span className="font-mono text-[11px] font-bold text-primary">
                        Fikr Cloud Active
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          userPlan === "Pro"
                            ? "bg-amber-500/20 text-amber-500 border border-amber-500/30"
                            : userPlan === "Plus"
                              ? "bg-blue-500/20 text-blue-500 border border-blue-500/30"
                              : "bg-muted text-muted-foreground border border-border/40"
                        }`}
                      >
                        {userPlan} Plan
                      </span>
                    </div>
                    <span className="font-mono text-xs text-foreground/70 block mb-3">
                      {user.email}
                    </span>
                    <div className="pt-2 border-t border-primary/20 flex items-center justify-between">
                      <span className="font-mono text-[10px] text-primary/70 uppercase">
                        Global Relay Enabled
                      </span>
                      <button
                        onClick={() => signOut(getFirebaseAuth())}
                        className="font-mono text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>

                  {/* Relay API Key */}
                  <div className="flex flex-col gap-2">
                    <label className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                      Relay API Key
                    </label>
                    <div className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/30 px-3 py-2.5">
                      <Key className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="flex-1 font-mono text-[12px] text-foreground/80 truncate">
                        {relayApiKey}
                      </span>
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(relayApiKey)
                        }
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                      This key authenticates cloud agents with your FikrPad
                      relay.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col items-center gap-4 py-6">
                    <Cloud className="h-8 w-8 text-muted-foreground/40" />
                    <div className="text-center">
                      <p className="font-mono text-[13px] font-bold text-foreground mb-1">
                        Not Connected
                      </p>
                      <p className="font-mono text-xs text-muted-foreground leading-relaxed max-w-[280px]">
                        Sign in to enable Fikr Cloud Relay. This allows external
                        agents to access your FikrPad globally.
                      </p>
                    </div>
                  </div>
                  {loginError && (
                    <p className="font-mono text-xs text-red-500">
                      {loginError}
                    </p>
                  )}
                  <button
                    onClick={() => {
                      setLoginError("");
                      // @ts-ignore
                      window.fikrpad?.openAuth();
                    }}
                    className="h-9 w-full bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary font-mono text-[12px] rounded-sm transition-all"
                  >
                    Login with Fikr.One
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── MCP Tab ── */}
          {activeTab === "mcp" && (
            <div className="flex flex-col gap-4">
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                Copy this JSON snippet into your MCP client configuration file
                to give your agent access to your FikrPad.
              </p>

              {user ? (
                <>
                  {/* Cloud MCP Config */}
                  <div className="flex flex-col gap-2">
                    <label className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-primary flex items-center gap-2">
                      <Cloud className="h-3 w-3" />
                      Cloud Relay
                    </label>
                    <div className="rounded-md border border-border/40 bg-muted/40 p-3.5 relative group">
                      <pre className="font-mono text-[11px] text-foreground/80 whitespace-pre-wrap">
                        {'"fikrpad-cloud": {\n  "command": "npx",\n  "args": [\n    "-y",\n    "fikrpad-mcp",\n    "https://fikr.one/api/mcp/relay"\n  ],\n  "env": {\n    "MCP_RELAY_KEY": "Bearer ' +
                          relayApiKey +
                          '"\n  }\n}'}
                      </pre>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `"fikrpad-cloud": {
  "command": "npx",
  "args": [
    "-y",
    "fikrpad-mcp",
    "https://fikr.one/api/mcp/relay"
  ],
  "env": {
    "MCP_RELAY_KEY": "Bearer ${relayApiKey}"
  }
}`,
                          );
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-sm bg-muted-foreground/10 hover:bg-muted-foreground/20 text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Local MCP Config */}
                  <div className="flex flex-col gap-2">
                    <label className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-2">
                      <Terminal className="h-3 w-3" />
                      Local
                    </label>
                    <div className="rounded-md border border-border/40 bg-muted/40 p-3.5 relative group">
                      <pre className="font-mono text-[11px] text-foreground/80 whitespace-pre-wrap">
                        {'"fikrpad": {\n  "command": "npx",\n  "args": [\n    "-y",\n    "fikrpad-mcp",\n    "http://localhost:' +
                          (mcpPort || 3025) +
                          '/sse"\n  ]\n}'}
                      </pre>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `"fikrpad": {
  "command": "npx",
  "args": [
    "-y",
    "fikrpad-mcp",
    "http://localhost:${mcpPort || 3025}/sse"
  ]
}`,
                          );
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-sm bg-muted-foreground/10 hover:bg-muted-foreground/20 text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Local Only MCP Config */}
                  <div className="flex flex-col gap-2">
                    <label className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-2">
                      <Terminal className="h-3 w-3" />
                      Local MCP
                    </label>
                    <div className="rounded-md border border-border/40 bg-muted/40 p-3.5 relative group">
                      <pre className="font-mono text-[11px] text-foreground/80 whitespace-pre-wrap">
                        {'"fikrpad": {\n  "command": "npx",\n  "args": [\n    "-y",\n    "fikrpad-mcp",\n    "http://localhost:' +
                          (mcpPort || 3025) +
                          '/sse"\n  ]\n}'}
                      </pre>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `"fikrpad": {
  "command": "npx",
  "args": [
    "-y",
    "fikrpad-mcp",
    "http://localhost:${mcpPort || 3025}/sse"
  ]
}`,
                          );
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-sm bg-muted-foreground/10 hover:bg-muted-foreground/20 text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 bg-muted/20 p-3 rounded-md border border-border/30">
                    <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                      Currently only accepting local connections. Sign in to
                      enable Fikr Cloud Relay for external agents.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-4 pt-2 border-t border-border/30 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 font-mono text-xs uppercase tracking-tight"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            className="h-8 font-mono text-xs uppercase tracking-tight gap-1.5"
          >
            <Save className="h-3 w-3" />
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
