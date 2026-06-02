"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
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
  ArrowRight,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { AI_PROVIDER_PRESETS, getPreset, type AISettings } from "@/lib/ai-settings";
import { signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { onSnapshot, updateDoc, doc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase";
import { analytics } from "@/lib/analytics";
import { ConnectionsPage } from "@/components/connections-page";

export type SettingsSection = "llm" | "account" | "connections";

interface SettingsPageProps {
  open: boolean;
  initialSection?: SettingsSection;
  aiSettings: AISettings;
  onUpdateAISettings: (patch: Partial<AISettings>) => void;
  mcpPort?: number | null;
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

  // Firebase
  useEffect(() => {
    const auth = getFirebaseAuth();
    const db = getFirebaseDb();
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const token = await u.getIdToken().catch(() => null);
        onSnapshot(doc(db, "users", u.uid), async (snap) => {
          if (!snap.exists()) return;
          const data = snap.data();
          const planRaw = data.plan || "Free";
          const plan = planRaw.charAt(0).toUpperCase() + planRaw.slice(1);
          setUserPlan(plan);
          if (!data.relayApiKey) {
            const newKey = "fp_" + crypto.randomUUID().replace(/-/g, "");
            await updateDoc(doc(db, "users", u.uid), { relayApiKey: newKey });
            setRelayApiKey(newKey);
            onAuthChange?.(u, token, plan, newKey);
          } else {
            setRelayApiKey(data.relayApiKey);
            onAuthChange?.(u, token, plan, data.relayApiKey);
          }
        });
      } else {
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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 sm:p-8"
          style={{ WebkitAppRegion: "no-drag" } as any}
        >
          <div className="w-full max-w-3xl h-[85vh] flex flex-col bg-background border border-border shadow-2xl rounded-2xl overflow-hidden relative">
            
            {/* ── Top Header & Nav ────────────────────────────────── */}
            <div className="shrink-0 flex flex-col border-b border-border/10 bg-background/50 z-10">
              <div className="flex items-center justify-between px-6 pt-6 pb-2" style={{ WebkitAppRegion: "drag" } as any}>
                <h2 className="text-xl font-bold tracking-tight text-foreground">Settings</h2>
                <button
                  onClick={onClose}
                  className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                  style={{ WebkitAppRegion: "no-drag" } as any}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="flex items-center gap-6 px-6 mt-2" style={{ WebkitAppRegion: "no-drag" } as any}>
                {NAV.filter(n => !(n.id === "llm" && isManagedPlan)).map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => { analytics.track("settings_nav", { section: id }); setSection(id); }}
                    className={`pb-3 text-sm font-semibold transition-all border-b-2 ${
                      section === id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            </div>

            {/* ── Main Content ────────────────────────────────── */}
            <div className={`flex-1 min-w-0 ${section === "connections" ? "overflow-hidden flex flex-col" : "overflow-y-auto custom-scrollbar"}`}>
              {section === "connections" ? (
                <ConnectionsPage
                  mcpPort={mcpPort ?? null}
                  plan={userPlan}
                  relayApiKey={relayApiKey}
                />
              ) : (
                <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
                  {/* Page header */}
                  <div className="mb-6">
                    <h1 className="text-xl font-bold text-foreground tracking-tight">
                      {NAV.find(n => n.id === section)?.label}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      {NAV.find(n => n.id === section)?.description}
                    </p>
                  </div>

                  {/* ── LLM Setup ── */}
                  {section === "llm" && (
                    <div className="flex flex-col gap-6">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Provider</label>
                        <div className="relative">
                          <button
                            onClick={() => setProviderOpen(v => !v)}
                            className="flex w-full items-center justify-between rounded-xl border border-border/40 bg-muted/20 px-4 py-3 hover:bg-muted/40 transition-colors"
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
                                className="absolute top-full left-0 right-0 z-20 mt-1.5 rounded-xl border border-border/40 bg-popover shadow-xl overflow-hidden"
                              >
                                {AI_PROVIDER_PRESETS.map(preset => (
                                  <button key={preset.id}
                                    onClick={() => { setDraft(d => ({ ...d, provider: preset.id, apiKey: "", taskModels: { analysis: null, tools: null, transcription: null, vision: null, embedding: null }, customBaseUrl: "" })); setProviderOpen(false); }}
                                    className="flex w-full items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
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
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">API Key</label>
                        <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/20 px-4 py-3 focus-within:border-primary/50 transition-colors">
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
                          <p className="text-xs text-muted-foreground">Stored locally — never sent to our servers.</p>
                          {currentPreset.keyUrl && currentPreset.keyUrl !== "#" && (
                            <a href={currentPreset.keyUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                              Get a key <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>

                      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${
                        draft.apiKey ? "bg-[#22C55E]/8 border-[#22C55E]/20 text-[#22C55E]" : "bg-muted/20 border-border/20 text-muted-foreground"
                      }`}>
                        <span className={`h-2 w-2 rounded-full shrink-0 ${draft.apiKey ? "bg-[#22C55E] animate-pulse" : "bg-muted-foreground/30"}`} />
                        {draft.apiKey ? `${currentPreset.label} — configured and ready` : "No API key — AI features disabled"}
                      </div>

                      <div className="pt-2 flex justify-end gap-3">
                        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                          Cancel
                        </button>
                        <button onClick={handleSave} className="px-5 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                          Save Changes
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Account ── */}
                  {section === "account" && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col gap-6"
                    >
                      {user ? (
                        <>
                          {/* Profile simple row */}
                          <div className="flex items-center gap-4 p-4 rounded-xl border border-border/40 bg-muted/10">
                            <div className="flex aspect-square size-14 items-center justify-center rounded-full bg-muted text-muted-foreground font-bold text-lg overflow-hidden shrink-0">
                              {user.photoURL
                                ? <img src={user.photoURL} alt="" className="h-full w-full object-cover" />
                                : (user.displayName?.charAt(0) || user.email?.charAt(0) || "U").toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-foreground text-lg leading-tight truncate">{user.displayName || "Fikr User"}</p>
                              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                            </div>
                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold border ${
                              isPro 
                                ? "bg-amber-400/10 border-amber-400/30 text-amber-500" 
                                : isPlus 
                                ? "bg-teal-400/10 border-teal-400/30 text-teal-500" 
                                : "bg-muted border-border/50 text-foreground"
                            }`}>
                              {isPro && <Zap className="size-3 shrink-0" />}
                              {isPlus && <Cloud className="size-3 shrink-0" />}
                              {userPlan} Plan
                            </div>
                          </div>

                          {isManagedPlan && (
                            <div className={`flex items-start gap-3 p-4 rounded-xl border ${
                              isPro ? "bg-amber-400/5 border-amber-400/20" : "bg-teal-400/5 border-teal-400/20"
                            }`}>
                              <div className={`shrink-0 mt-0.5 ${
                                isPro ? "text-amber-500" : "text-teal-500"
                              }`}>
                                {isPro ? <Zap className="h-4 w-4" /> : <Cloud className="h-4 w-4" />}
                              </div>
                              <div className="flex-1">
                                <p className={`font-semibold text-sm mb-0.5 ${isPro ? "text-amber-500" : "text-teal-500"}`}>
                                  Fikr Cloud Managed
                                </p>
                                <p className="text-xs text-muted-foreground/90">
                                  AI is routed through Fikr's managed infrastructure. Usage is capped per your {userPlan} plan.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Relay API key row */}
                          <div className="flex flex-col gap-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cloud Relay Key</label>
                            <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
                              <Key className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="flex-1 font-mono text-sm text-foreground/80 truncate selection:bg-primary/20">
                                {relayApiKey || "—"}
                              </span>
                              <button
                                onClick={() => { navigator.clipboard.writeText(relayApiKey); setCopiedRelay(true); setTimeout(() => setCopiedRelay(false), 1500); }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                                  copiedRelay 
                                    ? "bg-[#22C55E]/10 text-[#22C55E]" 
                                    : "bg-muted text-muted-foreground hover:bg-foreground hover:text-background"
                                }`}
                              >
                                {copiedRelay ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                {copiedRelay ? "Copied" : "Copy"}
                              </button>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Use this key to authenticate external AI agents with your Fikr Studio cloud relay.
                            </p>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-3 pt-4">
                            <button
                              onClick={() => (window as any).fikrStudio?.openUrl?.("https://fikr.one/dashboard")}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-muted/20 text-sm font-semibold hover:bg-muted transition-colors"
                            >
                              {isPro ? "Manage billing" : "Upgrade plan"} <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                            <button
                              onClick={() => signOut(getFirebaseAuth())}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-destructive/20 bg-destructive/5 text-sm font-semibold text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                            >
                              <LogOut className="h-3.5 w-3.5" />
                              Sign Out Fikr Cloud
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-center py-12 px-6 max-w-2xl mx-auto min-h-[50vh] justify-center">
                          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-6">
                            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                            Fikr Cloud
                          </div>
                          
                          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
                            Supercharge your workflow
                          </h1>
                          
                          <p className="text-muted-foreground text-base mb-8 max-w-lg leading-relaxed">
                            Connect to Fikr Cloud to unlock seamless real-time sync, premium managed AI models, and powerful integrations across all your devices.
                          </p>
                          
                          <div className="flex flex-col sm:flex-row items-center gap-4 mb-10 w-full justify-center">
                            <button
                              onClick={() => { setLoginError(""); (window as any).fikrStudio?.openAuth(); }}
                              className="inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8 w-full sm:w-auto shadow-sm"
                            >
                              Sign in to Fikr Cloud
                            </button>
                            <button
                              onClick={() => (window as any).fikrStudio?.openUrl?.("https://fikr.one")}
                              className="inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-11 px-8 w-full sm:w-auto shadow-sm"
                            >
                              Learn more
                            </button>
                          </div>
                          
                          {loginError && <p className="text-sm font-medium text-destructive mb-6 px-4 py-2 bg-destructive/10 rounded-md">{loginError}</p>}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-12 text-left max-w-xl mx-auto border-t border-border/50 pt-10">
                            <div className="flex items-start gap-3">
                              <RefreshCw className="h-5 w-5 text-foreground/70 shrink-0 mt-0.5" />
                              <div>
                                <h4 className="text-sm font-semibold text-foreground mb-1">Real-time Sync</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">Your canvas and notes instantly sync across all devices.</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <Sparkles className="h-5 w-5 text-foreground/70 shrink-0 mt-0.5" />
                              <div>
                                <h4 className="text-sm font-semibold text-foreground mb-1">Managed AI Models</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">Instant access to top-tier models without managing API keys.</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <Zap className="h-5 w-5 text-foreground/70 shrink-0 mt-0.5" />
                              <div>
                                <h4 className="text-sm font-semibold text-foreground mb-1">Automation Relay</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">Expose your canvas to external apps via secure webhooks.</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <Shield className="h-5 w-5 text-foreground/70 shrink-0 mt-0.5" />
                              <div>
                                <h4 className="text-sm font-semibold text-foreground mb-1">Secure & Private</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">Encrypted data. You always maintain ownership of your notes.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}


                {/* ── Connections (rendered outside this wrapper) ── */}

              </div>
              )} {/* end else (non-connections sections) */}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
