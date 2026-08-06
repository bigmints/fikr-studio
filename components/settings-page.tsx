"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Cpu,
  User,
  Plug,
  CreditCard,
  Key,
  Eye,
  EyeOff,
  ChevronDown,
  Check,
  Cloud,
  Terminal,
  ExternalLink,
  Copy,
  LogOut,
  Zap,
  Shield,
  ArrowLeft,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { AI_PROVIDER_PRESETS, getPreset, type AISettings } from "@/lib/ai-settings";
import { signOut, onIdTokenChanged, User as FirebaseUser } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { analytics } from "@/lib/analytics";
import { ConnectionsPage } from "@/components/connections-page";

export type SettingsSection = "llm" | "account" | "connections";

interface SettingsPageProps {
  open: boolean;
  initialSection?: SettingsSection;
  aiSettings: AISettings;
  onUpdateAISettings: (patch: Partial<AISettings>) => void;
  mcpPort?: number | null;
  mcpToken?: string | null;
  onClose: () => void;
  /** Lifted auth state for usage polling in parent */
  onAuthChange?: (user: any, idToken: string | null, plan: string, relayKey?: string) => void;
}

const NAV: { id: SettingsSection; label: string; description: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: "llm",          label: "LLM Setup",       description: "API keys & provider",          Icon: Cpu },
  { id: "account",      label: "Account",          description: "Profile & plan",               Icon: User },
  { id: "connections",  label: "Connections",      description: "AI clients & integrations",    Icon: Plug },
];

export function SettingsPage({
  open,
  initialSection = "account",
  aiSettings,
  onUpdateAISettings,
  mcpPort,
  mcpToken,
  onClose,
  onAuthChange,
}: SettingsPageProps) {
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [draft, setDraft] = useState<AISettings>(aiSettings);
  const [showKey, setShowKey] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userPlan, setUserPlan] = useState("Free");
  const [relayApiKey, setRelayApiKey] = useState("");
  const [copiedRelay, setCopiedRelay] = useState(false);
  const [loginError, setLoginError] = useState("");

  const isPro = userPlan.toLowerCase().includes("pro");
  const isPlus = userPlan.toLowerCase().includes("plus");
  const isManagedPlan = isPro || isPlus;
  const currentPreset = getPreset(draft.provider);

  // Jump to correct section when opened from different menu items
  useEffect(() => {
    if (open) {
      setSection(initialSection);
      setDraft(aiSettings);
    }
  }, [open, initialSection, aiSettings]);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && open) onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Firebase authentication; account authority comes from verified fikr.one APIs.
  useEffect(() => {
    const auth = getFirebaseAuth();
    // onIdTokenChanged fires for sign-in, sign-out, and automatic Firebase ID
    // token refreshes. Relay polling must not silently expire after one hour.
    const unsub = onIdTokenChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const token = await u.getIdToken().catch(() => null);
        const ipc = (window as any).fikrStudio;
        const verified = token && ipc?.setUser
          ? await ipc.setUser(u.uid, token).catch(() => null)
          : null;
        const account = verified && ipc?.getAccount
          ? await ipc.getAccount().catch(() => verified)
          : verified;
        const planRaw = account?.plan || "free";
        const plan = planRaw.charAt(0).toUpperCase() + planRaw.slice(1);
        const relayKey = account?.relayApiKey || "";
        setUserPlan(plan);
        setRelayApiKey(relayKey);
        onAuthChange?.(u, token, plan, relayKey);
      } else {
        const ipc = (window as any).fikrStudio;
        if (ipc?.setUser) await ipc.setUser(null, null).catch(() => null);
        setUserPlan("Free");
        setRelayApiKey("");
        onAuthChange?.(null, null, "Free", "");
      }
    });
    return () => unsub();
  }, [onAuthChange]);

  const handleSave = () => {
    onUpdateAISettings({ ...draft, apiKey: draft.apiKey.trim() });
    analytics.track("settings_save");
    onClose();
    toast("Settings saved");
  };

  const planBadgeClass = isPro
    ? "text-amber-400 bg-amber-400/10 border-amber-400/30"
    : isPlus
    ? "text-teal-400 bg-teal-400/10 border-teal-400/30"
    : "text-muted-foreground bg-muted/50 border-border/40";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="settings-page"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex bg-background"
          style={{ WebkitAppRegion: "no-drag" } as any}
        >
          {/* ── Left sidebar ────────────────────────────────── */}
          <aside className="w-56 shrink-0 flex flex-col bg-sidebar border-r border-border/50 h-full">
            {/* Drag region + back */}
            <div className="h-10 shrink-0" style={{ WebkitAppRegion: "drag" } as any} />
            <div className="px-4 pb-5 shrink-0">
              <button
                onClick={onClose}
                className="flex min-h-8 items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors group"
              >
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                Back to workspace
              </button>
            </div>

            <div className="px-4 pb-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                Settings
              </p>
            </div>

            <nav className="flex flex-col gap-0.5 px-2 flex-1">
              {NAV.filter(n => !(n.id === "llm" && isManagedPlan)).map(({ id, label, description, Icon }) => (
                <button
                  key={id}
                  onClick={() => { analytics.track("settings_nav", { section: id }); setSection(id); }}
                  className={`flex min-h-11 items-center gap-3 w-full px-3 rounded-md text-left transition-colors duration-100 group ${
                    section === id
                      ? "bg-foreground/[0.08] text-foreground"
                      : "text-foreground/70 hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                  <div className="flex flex-col leading-none gap-0.5">
                    <span className="text-[13px] font-medium">{label}</span>
                    <span className="text-[11px] text-muted-foreground/70">{description}</span>
                  </div>
                </button>
              ))}
            </nav>

            {/* Plan badge */}
            {user && (
              <div className="p-4 mt-auto shrink-0">
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-md border text-[13px] font-semibold tracking-tight transition-colors ${planBadgeClass}`}>
                  {isPro ? <Zap className="h-4 w-4 shrink-0" /> : isPlus ? <Cloud className="h-4 w-4 shrink-0" /> : <Shield className="h-4 w-4 shrink-0" />}
                  <span className="flex-1">{userPlan} Plan</span>
                  {!isManagedPlan && (
                    <button
                      onClick={() => window.open("https://fikr.one", "_blank")}
                      className="ml-auto flex items-center gap-1 text-primary hover:underline text-[11px] font-bold uppercase tracking-wider"
                    >
                      <Sparkles className="h-3 w-3" /> Upgrade
                    </button>
                  )}
                </div>
              </div>
            )}
          </aside>

          {/* ── Main content ────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Top bar */}
            <div className="h-10 shrink-0" style={{ WebkitAppRegion: "drag" } as any} />

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="mx-auto w-full max-w-[720px] px-8 py-10 space-y-8">

                {/* Page header */}
                {!(section === "account" && !user) && (
                  <div className="mb-8">
                    <h1 className="font-serif text-[30px] font-medium leading-tight text-foreground">
                      {NAV.find(n => n.id === section)?.label}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      {NAV.find(n => n.id === section)?.description}
                    </p>
                  </div>
                )}

                {/* ── Connections ── */}
                {section === "connections" && (
                  <ConnectionsPage
                    mcpPort={mcpPort ?? null}
                    mcpToken={mcpToken ?? null}
                    plan={userPlan}
                    relayApiKey={relayApiKey}
                  />
                )}

                {/* ── LLM Setup ── */}
                {section === "llm" && (
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[12px] font-semibold text-foreground">Provider</label>
                      <div className="relative">
                        <button
                          onClick={() => setProviderOpen(v => !v)}
                          className="flex min-h-11 w-full items-center justify-between rounded-md border border-border/70 bg-background px-3.5 hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <Cpu className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{currentPreset.label}</span>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${providerOpen ? "rotate-180" : ""}`} />
                        </button>
                        <AnimatePresence>
                          {providerOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.1 }}
                              className="absolute top-full left-0 right-0 z-20 mt-1.5 rounded-lg border border-border/60 bg-popover p-1.5 shadow-xl overflow-hidden"
                            >
                              {AI_PROVIDER_PRESETS.map(preset => (
                                <button key={preset.id}
                                  onClick={() => { setDraft(d => ({ ...d, provider: preset.id, apiKey: "", taskModels: { analysis: null, tools: null, transcription: null, vision: null, embedding: null }, customBaseUrl: "" })); setProviderOpen(false); }}
                                  className="flex min-h-9 w-full items-center gap-3 rounded-md px-3 text-[13px] hover:bg-foreground/[0.07] transition-colors"
                                >
                                  <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${draft.provider === preset.id ? "border-primary bg-primary" : "border-border/50"}`}>
                                    {draft.provider === preset.id && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                                  </div>
                                  <span className="text-sm font-medium">{preset.label}</span>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[12px] font-semibold text-foreground">API Key</label>
                      <div className="flex min-h-11 items-center gap-3 rounded-md border border-border/70 bg-background px-3.5 focus-within:border-foreground/50 transition-colors">
                        <Key className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <input
                          type="text"
                          value={draft.apiKey}
                          onChange={e => setDraft(d => ({ ...d, apiKey: e.target.value }))}
                          placeholder={currentPreset.keyPlaceholder || "Paste your API key here"}
                          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
                          style={showKey ? undefined : ({ WebkitTextSecurity: "disc" } as never)}
                          autoComplete="off" spellCheck={false}
                        />
                        <button onClick={() => setShowKey(v => !v)} className="text-muted-foreground hover:text-foreground transition-colors">
                          {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">Stored on this Mac and sent only to the selected AI provider.</p>
                        {currentPreset.keyUrl && currentPreset.keyUrl !== "#" && (
                          <a href={currentPreset.keyUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                            Get a key <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>



                    <div className="pt-2 flex justify-end gap-3">
                      <button onClick={onClose} className="min-h-9 px-4 rounded-md text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                        Cancel
                      </button>
                      <button onClick={handleSave} className="min-h-9 px-5 rounded-md text-[13px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                        Save Changes
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Account ── */}
                {section === "account" && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col gap-8"
                  >
                    {user ? (
                      <>
                        {/* Profile card */}
                        <div className="flex items-center gap-5 border-b border-border/60 pb-6">
                          <div className="relative flex aspect-square size-16 shrink-0 items-center justify-center rounded-full bg-muted border-2 border-background shadow-sm text-primary font-bold text-xl overflow-hidden">
                            {user.photoURL
                              ? <img src={user.photoURL} alt="" className="h-full w-full object-cover" />
                              : (user.displayName?.charAt(0) || user.email?.charAt(0) || "U").toUpperCase()}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="font-bold tracking-tight text-foreground text-lg truncate leading-tight">{user.displayName || "Fikr User"}</p>
                            <p className="text-sm text-muted-foreground truncate mb-2">{user.email}</p>
                            
                            <div className="flex items-center gap-3">
                              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${
                                isPro ? "bg-amber-500/10 border-amber-500/20 text-amber-600" : isPlus ? "bg-teal-500/10 border-teal-500/20 text-teal-600" : "bg-muted border-border text-muted-foreground"
                              }`}>
                                {isPro ? <Zap className="size-3" /> : isPlus ? <Cloud className="size-3" /> : null}
                                {userPlan}
                              </div>
                              <button
                                onClick={() => window.open("https://fikr.one/dashboard", "_blank")}
                                className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary hover:underline"
                              >
                                {isPro ? "Manage billing" : "Upgrade"} <ExternalLink className="size-3" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Simplified Actions */}
                        <div className="flex flex-col gap-2 mt-2">
                          <div className="flex min-h-16 items-center justify-between border-b border-border/50 py-3 transition-colors">
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className="p-2 rounded-md bg-muted text-foreground">
                                <Key className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground">Relay API Key</p>
                                <p className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-[300px] font-mono mt-0.5">{relayApiKey || "—"}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => { navigator.clipboard.writeText(relayApiKey); setCopiedRelay(true); setTimeout(() => setCopiedRelay(false), 1500); }}
                              className={`min-h-8 px-3 rounded-md text-xs font-semibold transition-colors shrink-0 ${copiedRelay ? "bg-[#22C55E]/10 text-[#22C55E]" : "bg-muted text-foreground hover:bg-foreground hover:text-background"}`}
                            >
                              {copiedRelay ? "Copied" : "Copy"}
                            </button>
                          </div>

                          <button
                            onClick={() => signOut(getFirebaseAuth())}
                            className="group flex min-h-16 items-center gap-3.5 border-b border-border/50 py-3 hover:text-destructive transition-colors w-full text-left"
                          >
                            <div className="p-2 rounded-md bg-muted text-muted-foreground group-hover:text-destructive transition-colors">
                              <LogOut className="h-4 w-4" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-foreground group-hover:text-destructive transition-colors">Sign Out</p>
                            </div>
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="py-8 sm:py-10">
                        <div className="flex flex-col items-start max-w-xl">
                          <div className="mb-6 inline-flex size-12 items-center justify-center rounded-lg bg-foreground text-background">
                            <Cloud className="h-6 w-6" />
                          </div>
                          
                          <h3 className="font-serif text-[32px] font-medium leading-tight text-foreground mb-3">
                            Take your workspace with you
                          </h3>
                          <p className="text-muted-foreground text-[15px] leading-relaxed mb-8 max-w-lg">
                            Add account-scoped cloud sync, managed AI access, and an authenticated relay while Studio is running.
                          </p>

                          <div className="grid gap-4 w-full text-left mb-9 sm:grid-cols-2">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 rounded-md bg-muted p-1.5 text-foreground">
                                <RefreshCw className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-foreground">Cloud Sync</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Account-scoped workspace mirror</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 rounded-md bg-muted p-1.5 text-foreground">
                                <Sparkles className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-foreground">Managed AI</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Verified Plus or Pro access</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 rounded-md bg-muted p-1.5 text-foreground">
                                <Zap className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-foreground">Cloud Relay</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Remote access while Studio is open</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 rounded-md bg-muted p-1.5 text-foreground">
                                <Shield className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-foreground">Private & Secure</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Your data is yours</p>
                              </div>
                            </div>
                          </div>

                          {loginError && <p className="text-[13px] font-bold text-destructive mb-4 px-4 py-2 bg-destructive/10 rounded-lg">{loginError}</p>}
                          
                          <button
                            onClick={() => { setLoginError(""); (window as any).fikrStudio?.openAuth(); }}
                            className="min-h-11 px-6 rounded-md bg-primary text-primary-foreground font-semibold text-[14px] transition-opacity hover:opacity-85"
                          >
                            Sign in with Fikr Cloud
                          </button>
                          
                          <p className="text-[12px] font-medium text-muted-foreground mt-4">
                            Free plan available. No credit card required.
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
