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
          className="fixed inset-0 z-[100] flex bg-background"
          style={{ WebkitAppRegion: "no-drag" } as any}
        >
          {/* ── Left sidebar ────────────────────────────────── */}
          <div className="w-64 shrink-0 flex flex-col bg-sidebar border-r border-border/20 h-full">
            {/* Drag region + back */}
            <div className="h-10 shrink-0" style={{ WebkitAppRegion: "drag" } as any} />
            <div className="px-4 pb-5 shrink-0">
              <button
                onClick={onClose}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
              >
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                Back to Canvas
              </button>
            </div>

            <div className="px-4 pb-2">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-muted-foreground/50">
                Settings
              </p>
            </div>

            <nav className="flex flex-col gap-0.5 px-2 flex-1">
              {NAV.filter(n => !(n.id === "llm" && isManagedPlan)).map(({ id, label, description, Icon }) => (
                <button
                  key={id}
                  onClick={() => { analytics.track("settings_nav", { section: id }); setSection(id); }}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-all duration-100 group ${
                    section === id
                      ? "bg-primary/10 text-primary"
                      : "text-foreground/70 hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${section === id ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                  <div className="flex flex-col leading-none gap-0.5">
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-[10px] text-muted-foreground/70">{description}</span>
                  </div>
                </button>
              ))}
            </nav>

            {/* Plan badge */}
            {user && (
              <div className="p-4 mt-auto shrink-0">
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[13px] font-semibold tracking-tight transition-all ${planBadgeClass}`}>
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
          </div>

          {/* ── Main content ────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Top bar */}
            <div className="h-10 shrink-0 flex items-center justify-end px-6 border-b border-border/10" style={{ WebkitAppRegion: "drag" } as any}>
              <button
                onClick={onClose}
                className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                style={{ WebkitAppRegion: "no-drag" } as any}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">

                {/* Page header */}
                <div className="mb-8">
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">
                    {NAV.find(n => n.id === section)?.label}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {NAV.find(n => n.id === section)?.description}
                  </p>
                </div>

                {/* ── Connections ── */}
                {section === "connections" && (
                  <ConnectionsPage
                    mcpPort={mcpPort ?? null}
                    plan={userPlan}
                    relayApiKey={relayApiKey}
                  />
                )}

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
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col gap-8"
                  >
                    {user ? (
                      <>
                        {/* Profile card */}
                        <div className="relative overflow-hidden flex items-center gap-5 p-6 rounded-3xl border border-border/30 bg-gradient-to-b from-muted/20 to-background shadow-sm">
                          {/* Subtle ambient glow behind avatar */}
                          <div className="absolute top-0 left-0 w-32 h-32 bg-primary/20 blur-3xl rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                          
                          <div className="relative flex aspect-square size-20 shrink-0 items-center justify-center rounded-full bg-background border-4 border-background shadow-xl text-primary font-bold text-2xl overflow-hidden z-10">
                            {user.photoURL
                              ? <img src={user.photoURL} alt="" className="h-full w-full object-cover" />
                              : (user.displayName?.charAt(0) || user.email?.charAt(0) || "U").toUpperCase()}
                          </div>
                          
                          <div className="flex-1 min-w-0 z-10">
                            <p className="font-black tracking-tight text-foreground text-2xl leading-none mb-1.5 truncate">{user.displayName || "Fikr User"}</p>
                            <p className="text-sm font-medium text-muted-foreground truncate">{user.email}</p>
                          </div>
                          
                          <div className="z-10">
                            <div className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold border shadow-sm ${
                              isPro 
                                ? "bg-amber-400/10 border-amber-400/30 text-amber-500" 
                                : isPlus 
                                ? "bg-teal-400/10 border-teal-400/30 text-teal-500" 
                                : "bg-muted border-border text-foreground"
                            }`}>
                              {isPro && <Zap className="size-3.5 shrink-0" />}
                              {isPlus && <Cloud className="size-3.5 shrink-0" />}
                              {userPlan}
                            </div>
                          </div>
                        </div>

                        {isManagedPlan && (
                          <div className={`relative overflow-hidden flex items-start gap-4 p-5 rounded-2xl border ${
                            isPro ? "bg-gradient-to-br from-amber-400/10 to-amber-400/5 border-amber-400/20" : "bg-gradient-to-br from-teal-400/10 to-teal-400/5 border-teal-400/20"
                          }`}>
                            <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 shadow-sm ${
                              isPro ? "bg-amber-400/20 text-amber-500" : "bg-teal-400/20 text-teal-500"
                            }`}>
                              {isPro
                                ? <Zap className="h-5 w-5" />
                                : <Cloud className="h-5 w-5" />}
                            </div>
                            <div className="flex-1">
                              <p className={`font-bold text-[15px] tracking-tight mb-1 ${isPro ? "text-amber-500" : "text-teal-500"}`}>
                                Fikr Cloud Managed
                              </p>
                              <p className="text-[13px] text-muted-foreground/90 leading-relaxed max-w-lg">
                                AI is routed through Fikr's managed infrastructure. No API key required.
                                Usage is tracked and capped per your {userPlan} plan.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Relay API key */}
                        <div className="flex flex-col gap-3">
                          <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Cloud Relay Key</label>
                          <div className="group flex items-center gap-3 rounded-2xl border border-border/40 bg-card/50 shadow-sm px-4 py-3.5 hover:border-border/80 hover:shadow-md transition-all duration-300">
                            <div className="p-2 rounded-lg bg-muted/50 text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
                              <Key className="h-4 w-4" />
                            </div>
                            <span className="flex-1 font-mono text-[13px] tracking-tight text-foreground/80 truncate selection:bg-primary/20">
                              {relayApiKey || "—"}
                            </span>
                            <button
                              onClick={() => { navigator.clipboard.writeText(relayApiKey); setCopiedRelay(true); setTimeout(() => setCopiedRelay(false), 1500); }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                                copiedRelay 
                                  ? "bg-[#22C55E]/10 text-[#22C55E]" 
                                  : "bg-muted text-muted-foreground hover:bg-foreground hover:text-background shadow-sm"
                              }`}
                            >
                              {copiedRelay ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                              {copiedRelay ? "Copied" : "Copy"}
                            </button>
                          </div>
                          <p className="text-[12px] text-muted-foreground ml-1">
                            Use this key to authenticate external AI agents with your Fikr Studio cloud relay.
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                          {/* Plan row */}
                          <div className={`flex flex-col justify-between p-5 rounded-2xl border transition-all duration-300 hover:shadow-md ${
                            isPro ? "bg-amber-400/[0.03] border-amber-400/20 hover:border-amber-400/40" : isPlus ? "bg-teal-400/[0.03] border-teal-400/20 hover:border-teal-400/40" : "bg-muted/5 border-border/20"
                          }`}>
                            <div className="flex items-center gap-2 mb-4">
                              <div className={`p-1.5 rounded-md ${isPro ? "bg-amber-400/20" : isPlus ? "bg-teal-400/20" : "bg-muted"}`}>
                                {isPro ? <Zap className="h-4 w-4 text-amber-500" /> : isPlus ? <Cloud className="h-4 w-4 text-teal-500" /> : <Shield className="h-4 w-4 text-muted-foreground" />}
                              </div>
                              <span className={`text-[15px] font-bold tracking-tight ${
                                isPro ? "text-amber-500" : isPlus ? "text-teal-500" : "text-foreground"
                              }`}>{userPlan} Plan</span>
                            </div>
                            <button
                              onClick={() => window.open("https://fikr.one/dashboard", "_blank")}
                              className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-background border border-border shadow-sm text-[13px] font-bold text-foreground hover:bg-muted transition-colors"
                            >
                              <span>{isPro ? "Manage billing" : "Upgrade plan"}</span> 
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </div>

                          <div className="flex flex-col justify-end p-5 rounded-2xl border border-destructive/10 bg-destructive/[0.02] transition-all duration-300 hover:border-destructive/30 hover:bg-destructive/[0.04]">
                            <div className="flex-1" />
                            <button
                              onClick={() => signOut(getFirebaseAuth())}
                              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-[13px] font-bold text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all duration-200 shadow-sm"
                            >
                              <LogOut className="h-4 w-4" />
                              Sign Out Fikr Cloud
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-b from-primary/10 to-transparent p-8 sm:p-10 shadow-sm mt-4">
                        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
                        
                        <div className="relative z-10 flex flex-col items-center text-center max-w-lg mx-auto">
                          <div className="inline-flex items-center justify-center p-3 rounded-2xl mb-6 shadow-md"
                               style={{ background: "linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 70%, #7c3aed) 100%)" }}>
                            <Cloud className="h-8 w-8 text-white" />
                          </div>
                          
                          <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground mb-3">
                            Unlock Fikr Cloud
                          </h3>
                          <p className="text-muted-foreground text-[15px] leading-relaxed mb-8">
                            Supercharge your workflow with seamless sync, premium AI models, and powerful integrations across all your devices.
                          </p>

                          <div className="grid grid-cols-2 gap-x-6 gap-y-4 w-full text-left mb-10">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 rounded-md bg-blue-500/10 p-1.5 text-blue-500">
                                <RefreshCw className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-foreground">Real-time Sync</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Notes synced everywhere</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 rounded-md bg-emerald-500/10 p-1.5 text-emerald-500">
                                <Sparkles className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-foreground">Managed Models</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Claude 3.5 & more</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 rounded-md bg-purple-500/10 p-1.5 text-purple-500">
                                <Zap className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-foreground">Cloud Relay</p>
                                <p className="text-xs text-muted-foreground mt-0.5">External agent hooks</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 rounded-md bg-amber-500/10 p-1.5 text-amber-500">
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
                            className="relative overflow-hidden group w-full sm:w-auto px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-[15px] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/25"
                          >
                            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                            <span className="relative z-10">Sign in with Fikr Cloud</span>
                          </button>
                          
                          <p className="text-[12px] font-medium text-muted-foreground mt-4 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Free plan available. No credit card required.
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
