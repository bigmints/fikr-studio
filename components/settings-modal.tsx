"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Key,
  Eye,
  EyeOff,
  ChevronDown,
  Copy,
  Cloud,
  Terminal,
  Plug,
  Check,
  X,
  User,
  Shield,
  Cpu,
  Zap,
  ExternalLink,
  LogOut,
  Save,
} from "lucide-react";
import {
  AI_PROVIDER_PRESETS,
  getPreset,
  type AISettings,
  type AIProvider,
  type AITask,
} from "@/lib/ai-settings";
import {
  signInWithCustomToken,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import { onSnapshot, updateDoc, doc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase";
import { analytics } from "@/lib/analytics";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aiSettings: AISettings;
  onUpdateAISettings: (patch: Partial<AISettings>) => void;
  mcpPort?: number | null;
  /** Called on every auth state change — gives parent access to idToken for usage polling */
  onAuthChange?: (user: FirebaseUser | null, idToken: string | null, plan: string) => void;
}

type Tab = "llm" | "account";

const NAV_ITEMS: { id: Tab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: "llm", label: "AI Engine", icon: Cpu },
  { id: "account", label: "My Account", icon: User },
];

export function SettingsModal({
  open,
  onOpenChange,
  aiSettings,
  onUpdateAISettings,
  mcpPort,
  onAuthChange,
}: SettingsModalProps) {
  // Default to "account" so managed-plan users never see the LLM tab flash
  const [activeTab, setActiveTab] = useState<Tab>("account");
  const [showKey, setShowKey] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);
  const [draft, setDraft] = useState<AISettings>(aiSettings);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userPlan, setUserPlan] = useState<string>("Free");
  const [relayApiKey, setRelayApiKey] = useState<string>("");
  const [loginError, setLoginError] = useState("");
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isPro = userPlan.toLowerCase().includes("pro");
  // Catch "plus", "Plus", "PLUS", "plus_plan", etc.
  const isPlus = userPlan.toLowerCase().includes("plus");
  // Plus AND Pro both use managed AI — no BYOK needed
  const isManagedPlan = isPro || isPlus;
  const visibleNavItems = NAV_ITEMS.filter((n) => !(isManagedPlan && n.id === "llm"));

  // Ensure Plus/Pro users don't get stuck on the hidden LLM tab
  useEffect(() => {
    if (isManagedPlan && activeTab === "llm") {
      setActiveTab("account");
    }
  }, [isManagedPlan, activeTab]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onOpenChange(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync draft on open
  useEffect(() => {
    if (open) setDraft(aiSettings);
  }, [open, aiSettings]);

  // Firebase Auth
  useEffect(() => {
    const auth = getFirebaseAuth();
    const db = getFirebaseDb();

    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      // Notify the Electron main process of the auth state change.
      // This enables Data Connect sync and triggers the one-shot legacy migration.
      // Pass idToken so main.js can call fikr.one APIs (e.g. server-side embedding).
      // @ts-ignore
      window.fikrStudio?.setUser(u?.uid ?? null, token ?? null);

      if (u) {
        // Get the idToken for usage API polling and lift it to parent
        const token = await u.getIdToken().catch(() => null);

        onSnapshot(doc(db, "users", u.uid), async (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const planRaw = data.plan || "Free";
            const plan = planRaw.charAt(0).toUpperCase() + planRaw.slice(1);
            console.log("[SettingsModal] Firestore plan raw:", planRaw, "→ normalized:", plan);
            setUserPlan(plan);
            // Notify parent with fresh token + plan
            onAuthChange?.(u, token, plan);
            if (!data.relayApiKey) {
              const key = "fp_" + crypto.randomUUID().replace(/-/g, "");
              await updateDoc(doc(db, "users", u.uid), { relayApiKey: key });
              setRelayApiKey(key);
            } else {
              setRelayApiKey(data.relayApiKey);
            }
          }
        });
      } else {
        setUserPlan("Free");
        setRelayApiKey("");
        onAuthChange?.(null, null, "Free");
      }
    });

    // @ts-ignore
    const ipc = window.fikrStudio?.onExternalEvent?.((ev: any) => {
      if (ev.type === "auth-token" && ev.payload?.token) {
        signInWithCustomToken(auth, ev.payload.token).catch((e) =>
          setLoginError(e.message)
        );
      }
    });

    return () => {
      unsub();
      // @ts-ignore
      if (ipc) ipc();
    };
  }, [onAuthChange]);

  const handleSave = () => {
    onUpdateAISettings({ ...draft, apiKey: draft.apiKey.trim() });
    analytics.track("settings_save");
    onOpenChange(false);
  };

  const copyKey = () => {
    navigator.clipboard.writeText(relayApiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const currentPreset = getPreset(draft.provider);

  const planColor = isPro
    ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
    : isPlus
    ? "text-teal-400 bg-teal-400/10 border-teal-400/20"
    : "text-muted-foreground bg-muted/50 border-border/40";

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[200] flex"
          style={{ WebkitAppRegion: "no-drag" } as any}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />

          {/* Panel */}
          <motion.div
            initial={{ scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative m-auto flex w-full max-w-4xl h-[680px] rounded-xl overflow-hidden shadow-2xl border border-border/20 bg-background"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Left Sidebar ──────────────────────────────────────── */}
            <div className="w-56 flex flex-col shrink-0 bg-sidebar border-r border-border/20">
              <div className="px-5 pt-7 pb-5">
                <p className="text-[11px] font-mono font-bold uppercase tracking-[0.15em] text-muted-foreground/60">
                  Preferences
                </p>
              </div>

              <nav className="flex flex-col gap-0.5 px-2 flex-1">
                {visibleNavItems.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => {
                      analytics.track("settings_tab_switch", { tab: id });
                      setActiveTab(id);
                    }}
                    className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-100 text-left ${
                      activeTab === id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </button>
                ))}
              </nav>

              {/* Plan badge at bottom */}
              {user && (
                <div className="p-4 mt-auto shrink-0">
                  <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[13px] font-semibold tracking-tight transition-all ${planColor}`}>
                    {isPro ? <Zap className="h-4 w-4 shrink-0" /> : isPlus ? <Cloud className="h-4 w-4 shrink-0" /> : <Shield className="h-4 w-4 shrink-0" />}
                    <span className="flex-1">{userPlan} Plan</span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Right Content ──────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Header */}
              <div className="flex items-center justify-between px-8 pt-7 pb-5 shrink-0 border-b border-border/10">
                <div>
                  <h1 className="text-xl font-semibold text-foreground tracking-tight">
                    {NAV_ITEMS.find((n) => n.id === activeTab)?.label}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {activeTab === "llm" && "Configure your AI provider and API credentials"}
                    {activeTab === "account" && "Manage your cloud account and subscription plan"}
                  </p>
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">

                {/* ── LLM Setup ──────────────────────────────── */}
                {activeTab === "llm" && (
                  <div className="flex flex-col gap-6 max-w-lg">

                    {/* Managed AI banner — Plus & Pro */}
                    {isManagedPlan && (
                      <div className={`flex items-start gap-3 p-4 rounded-xl border ${
                        isPro
                          ? "bg-amber-400/5 border-amber-400/20"
                          : "bg-teal-400/5 border-teal-400/20"
                      }`}>
                        {isPro
                          ? <Zap className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                          : <Cloud className="h-4 w-4 text-teal-400 mt-0.5 shrink-0" />}
                        <div>
                          <p className={`text-sm font-semibold leading-none mb-1 ${
                            isPro ? "text-amber-400" : "text-teal-400"
                          }`}>Fikr Cloud Managed</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            You're on {userPlan}. AI is routed through Fikr's managed infrastructure — no API key needed.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Provider select */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                        Provider
                      </label>
                      <div className="relative">
                        <button
                          onClick={() => { if (!isManagedPlan) setProviderOpen((v) => !v); }}
                          disabled={isManagedPlan}
                          className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                            isManagedPlan
                              ? "bg-muted/20 border-border/20 opacity-60 cursor-not-allowed"
                              : "bg-muted/30 border-border/40 hover:bg-muted/50 hover:border-border/60"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Cpu className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium text-foreground">
                              {isManagedPlan ? "Fikr Cloud Managed" : currentPreset.label}
                            </span>
                          </div>
                          {!isManagedPlan && (
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${providerOpen ? "rotate-180" : ""}`} />
                          )}
                        </button>

                        <AnimatePresence>
                          {providerOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.1 }}
                              className="absolute top-full left-0 right-0 z-20 mt-1.5 overflow-hidden rounded-xl border border-border/40 bg-popover shadow-xl"
                            >
                              {AI_PROVIDER_PRESETS.map((preset) => (
                                <button
                                  key={preset.id}
                                  onClick={() => {
                                    setDraft((d) => ({
                                      ...d,
                                      provider: preset.id,
                                      taskModels: { analysis: null, tools: null, transcription: null, vision: null, embedding: null },
                                      customBaseUrl: "",
                                      apiKey: "",
                                    }));
                                    analytics.track("provider_switch", { provider: preset.id });
                                    setProviderOpen(false);
                                  }}
                                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent/50 transition-colors"
                                >
                                  <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                    draft.provider === preset.id ? "border-primary bg-primary" : "border-border/50"
                                  }`}>
                                    {draft.provider === preset.id && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                                  </div>
                                  <span className="text-sm font-medium text-foreground">{preset.label}</span>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* API Key — Free only */}
                    {!isManagedPlan && (
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                          API Key
                        </label>
                        <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/30 px-4 py-3 focus-within:border-primary/50 transition-colors">
                          <Key className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <input
                            type="text"
                            value={draft.apiKey}
                            onChange={(e) => setDraft((d) => ({ ...d, apiKey: e.target.value }))}
                            placeholder={currentPreset.keyPlaceholder || "Paste your API key here"}
                            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
                            style={showKey ? undefined : ({ WebkitTextSecurity: "disc" } as never)}
                            autoComplete="off"
                            spellCheck={false}
                          />
                          <button onClick={() => setShowKey((v) => !v)} className="text-muted-foreground hover:text-foreground transition-colors">
                            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">Stored locally, never sent to our servers.</p>
                          {currentPreset.keyUrl && currentPreset.keyUrl !== "#" && (
                            <a href={currentPreset.keyUrl} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-primary hover:underline">
                              Get a key <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Status pill */}
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${
                      isPro
                        ? "bg-amber-400/5 border-amber-400/20 text-amber-400"
                        : isPlus
                        ? "bg-teal-400/5 border-teal-400/20 text-teal-400"
                        : draft.apiKey
                        ? "bg-[#22C55E]/8 border-[#22C55E]/20 text-[#22C55E]"
                        : "bg-muted/30 border-border/30 text-muted-foreground"
                    }`}>
                      <span className={`h-2 w-2 rounded-full ${
                        isPro
                          ? "bg-amber-400 animate-pulse"
                          : isPlus
                          ? "bg-teal-400 animate-pulse"
                          : draft.apiKey
                          ? "bg-[#22C55E] animate-pulse"
                          : "bg-muted-foreground/30"
                      }`} />
                      {isPro
                        ? "Routed via Fikr Cloud — Pro"
                        : isPlus
                        ? "Routed via Fikr Cloud — Plus"
                        : draft.apiKey
                        ? `${currentPreset.label} — ready`
                        : "No API key — AI features disabled"}
                    </div>
                  </div>
                )}

                {/* ── Manage Account ──────────────────────────────── */}
                {activeTab === "account" && (
                  <div className="flex flex-col gap-6 max-w-lg">
                    {user ? (
                      <>
                        {/* Profile card */}
                        <div className="flex items-center gap-4 p-5 rounded-xl border border-border/30 bg-muted/20">
                          <div className="flex aspect-square size-14 items-center justify-center rounded-full bg-primary/15 text-primary font-bold text-xl shrink-0">
                            {user.photoURL
                              ? <img src={user.photoURL} alt="" className="h-full w-full rounded-full object-cover" />
                              : (user.displayName?.charAt(0) || user.email?.charAt(0) || "U").toUpperCase()
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground truncate">{user.displayName || "Fikr User"}</p>
                            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                          </div>
                          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${planColor}`}>
                            {isPro && <Zap className="size-3 shrink-0" />}
                            {isPlus && <Cloud className="size-3 shrink-0" />}
                            {userPlan}
                          </div>
                        </div>

                        {/* Relay API Key */}
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                            Cloud Relay Key
                          </label>
                          <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/30 px-4 py-3">
                            <Key className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="flex-1 font-mono text-xs text-foreground/70 truncate">{relayApiKey || "—"}</span>
                            <button onClick={copyKey} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                              {copied ? <Check className="h-3.5 w-3.5 text-[#22C55E]" /> : <Copy className="h-3.5 w-3.5" />}
                              {copied ? "Copied" : "Copy"}
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Use this key to authenticate external AI agents with your Fikr Studio relay.
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 pt-2">
                          <button
                            onClick={() => window.open("https://fikr.one/dashboard", "_blank")}
                            className="flex items-center gap-2.5 w-full px-4 py-3 rounded-xl border border-border/30 bg-muted/20 hover:bg-muted/40 text-sm font-medium text-foreground transition-colors"
                          >
                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            Manage Subscription on fikr.one
                          </button>
                          <button
                            onClick={() => signOut(getFirebaseAuth())}
                            className="flex items-center gap-2.5 w-full px-4 py-3 rounded-xl border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 text-sm font-medium text-destructive transition-colors"
                          >
                            <LogOut className="h-4 w-4" />
                            Sign Out
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-5 py-12">
                        <div className="flex aspect-square size-16 items-center justify-center rounded-2xl bg-muted/40 text-muted-foreground/40">
                          <Cloud className="h-8 w-8" />
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-foreground mb-1">Not connected to Fikr Cloud</p>
                          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                            Sign in to enable cloud sync, managed AI inference, and external agent relay.
                          </p>
                        </div>
                        {loginError && <p className="text-sm text-destructive">{loginError}</p>}
                        <button
                          onClick={() => { setLoginError(""); (window as any).fikrStudio?.openAuth(); }}
                          className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                          Sign in with Fikr Cloud
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-8 py-5 border-t border-border/10 bg-background/50 backdrop-blur-sm shrink-0">
                <button
                  onClick={() => { analytics.track("settings_close"); onOpenChange(false); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save Changes
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
