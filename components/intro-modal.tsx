"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Cloud, Key, ChevronDown, Check, Bell, ChevronRight, Eye, EyeOff, CheckCircle2, Sparkles, Wand2 } from "lucide-react"
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase"
import { onAuthStateChanged, User, signInWithCustomToken } from "firebase/auth"
import { doc, onSnapshot } from "firebase/firestore"
import { useAISettings, AI_PROVIDER_PRESETS, type AIProvider, getPreset } from "@/lib/ai-settings"
import { analytics } from "@/lib/analytics"

interface IntroModalProps {
  open: boolean
  onClose: () => void
}

type Step = "intro" | "auth" | "notifications"

export function IntroModal({ open, onClose }: IntroModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  
  const [step, setStep] = useState<Step>("intro")
  const [authMode, setAuthMode] = useState<"choose" | "byok">("choose")
  const [showKey, setShowKey] = useState(false)
  const [providerOpen, setProviderOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [userPlan, setUserPlan] = useState<string>("Free")
  const [loginError, setLoginError] = useState("")

  const { settings, updateSettings } = useAISettings()
  const [draftProvider, setDraftProvider] = useState<AIProvider>(settings.provider)
  const [draftKey, setDraftKey] = useState(settings.apiKey)

  useEffect(() => {
    if (open) {
      setStep("intro")
      setAuthMode("choose")
      setDraftProvider(settings.provider)
      setDraftKey(settings.apiKey)
    }
  }, [open, settings])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handle)
    return () => window.removeEventListener("keydown", handle)
  }, [open, onClose])

  // Prevent body scroll while open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden"
    else document.body.style.overflow = ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  // Firebase Auth listener
  useEffect(() => {
    const auth = getFirebaseAuth()
    const db = getFirebaseDb()

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        onSnapshot(doc(db, "users", currentUser.uid), (snap) => {
          if (snap.exists()) {
            setUserPlan(snap.data().plan || "Free")
          }
        })
      } else {
        setUserPlan("Free")
      }
    })

    // @ts-ignore
    const unsubscribeIpc = window.fikrStudio?.onExternalEvent?.((eventData) => {
      if (eventData.type === "auth-token" && eventData.payload?.token) {
        signInWithCustomToken(auth, eventData.payload.token).then(() => {
          setStep("notifications")
        }).catch((err) =>
          setLoginError(err.message)
        )
      }
    })

    return () => {
      unsubscribeAuth()
      // @ts-ignore
      if (unsubscribeIpc) unsubscribeIpc()
    }
  }, [])

  const handleSaveByok = () => {
    updateSettings({ provider: draftProvider, apiKey: draftKey.trim() })
    setStep("notifications")
  }

  const handleRequestNotifications = async () => {
    try {
      if ("Notification" in window) {
        await Notification.requestPermission()
      }
      onClose()
    } catch (e) {
      console.error("Failed to request notifications", e)
      onClose()
    }
  }

  const currentPreset = getPreset(draftProvider)

  const steps = ["intro", "auth", "notifications"]
  const currentStepIndex = steps.indexOf(step)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 sm:p-6"
          onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
        >
          {/* Ambient Background Glow behind the modal */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-primary/20 blur-[120px] rounded-full pointer-events-none"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-[600px] bg-background/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{ minHeight: "480px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05) inset" }}
          >
            {/* Inner Animated Gradient Ring */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
              <motion.div
                animate={{ 
                  backgroundPosition: ["0% 0%", "100% 100%"],
                  opacity: [0.3, 0.5, 0.3]
                }}
                transition={{ duration: 10, repeat: Infinity, repeatType: "reverse" }}
                className="absolute -inset-[100%] opacity-30"
                style={{
                  background: "radial-gradient(circle at center, var(--primary) 0%, transparent 50%)",
                  filter: "blur(60px)",
                  mixBlendMode: "screen",
                }}
              />
            </div>

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between px-8 pt-8 pb-4 shrink-0">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20">
                    <img src="./logo-icon.png" alt="Fikr Studio" className="h-5 w-5 object-contain brightness-0 invert" />
                  </div>
                  <span className="font-mono text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-foreground to-foreground/70 tracking-tight">Fikr Studio</span>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  {steps.map((s, idx) => (
                    <div
                      key={s}
                      className={`h-1 rounded-full transition-all duration-500 ease-out ${
                        idx <= currentStepIndex ? "w-12 bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "w-4 bg-white/10"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-white/10 transition-all duration-200 hover:scale-105 active:scale-95"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Area */}
            <div className="relative z-10 flex-1 px-8 py-6 flex flex-col justify-center">
              <AnimatePresence mode="wait">
                {/* STEP 1: INTRO */}
                {step === "intro" && (
                  <motion.div
                    key="intro"
                    initial={{ opacity: 0, filter: "blur(10px)", x: 20 }}
                    animate={{ opacity: 1, filter: "blur(0px)", x: 0 }}
                    exit={{ opacity: 0, filter: "blur(10px)", x: -20 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="flex flex-col h-full"
                  >
                    <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-foreground via-foreground/90 to-foreground/60 mb-4 tracking-tight">
                      Intelligence emerges.
                    </h2>
                    <p className="text-muted-foreground/90 text-base leading-relaxed mb-8 max-w-[480px]">
                      Fikr Studio is your spatial thinking environment. Capture raw thoughts, and watch as AI automatically categorises, annotates, and weaves them together in real-time.
                    </p>
                    
                    <div className="space-y-6 flex-1">
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}
                        className="flex items-start gap-5 group"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary mt-0.5 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300 shadow-[0_0_15px_transparent] group-hover:shadow-primary/20">
                          <Wand2 className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-foreground text-base font-semibold mb-1">Zero-friction capture</h3>
                          <p className="text-sm text-muted-foreground/80 leading-relaxed">No folders. No tags. Just type and hit enter. The engine structures everything seamlessly.</p>
                        </div>
                      </motion.div>
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}
                        className="flex items-start gap-5 group"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 mt-0.5 group-hover:scale-110 group-hover:bg-purple-500/20 transition-all duration-300 shadow-[0_0_15px_transparent] group-hover:shadow-purple-500/20">
                          <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-foreground text-base font-semibold mb-1">Infinite spatial canvas</h3>
                          <p className="text-sm text-muted-foreground/80 leading-relaxed">See the shape of your thoughts. Navigate visually and let unexpected connections surface.</p>
                        </div>
                      </motion.div>
                    </div>

                    <div className="mt-10 flex justify-end">
                      <button
                        onClick={() => setStep("auth")}
                        className="group relative overflow-hidden px-6 py-3 text-sm font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-all duration-300 flex items-center gap-2 hover:gap-3 shadow-xl hover:shadow-2xl hover:shadow-foreground/20 active:scale-[0.98]"
                      >
                        <span className="relative z-10">Configure Engine</span> 
                        <ChevronRight className="h-4 w-4 relative z-10 transition-transform" />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* STEP 2: AUTH */}
                {step === "auth" && (
                  <motion.div
                    key="auth"
                    initial={{ opacity: 0, filter: "blur(10px)", x: 20 }}
                    animate={{ opacity: 1, filter: "blur(0px)", x: 0 }}
                    exit={{ opacity: 0, filter: "blur(10px)", x: -20 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="flex flex-col h-full"
                  >
                    <h2 className="text-3xl font-extrabold text-foreground mb-3 tracking-tight">Connect AI Engine</h2>
                    <p className="text-muted-foreground/80 text-base mb-8">
                      Fikr Studio relies on an active AI connection to process and enrich your workspace.
                    </p>

                    {user ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 py-8">
                        <motion.div 
                          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}
                          className="relative"
                        >
                          <div className="absolute inset-0 bg-[#3CA6A6]/20 blur-xl rounded-full animate-pulse" />
                          <div className="relative h-20 w-20 rounded-full bg-[#3CA6A6]/10 border border-[#3CA6A6]/30 text-[#3CA6A6] flex items-center justify-center backdrop-blur-md">
                            <CheckCircle2 className="h-10 w-10" />
                          </div>
                        </motion.div>
                        <div>
                          <h3 className="text-xl font-bold text-foreground">Connected to Fikr Cloud</h3>
                          <p className="text-sm text-muted-foreground mt-2">Authenticated as <span className="text-foreground">{user.email}</span></p>
                          <div className="mt-4">
                            <span className="inline-flex items-center justify-center px-3 py-1 bg-gradient-to-r from-primary/20 to-purple-500/20 text-primary text-xs uppercase font-black tracking-widest rounded-full border border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.2)]">
                              {userPlan} Plan
                            </span>
                          </div>
                        </div>
                        <div className="mt-auto pt-8 flex justify-end w-full">
                          <button
                            onClick={() => setStep("notifications")}
                            className="px-6 py-3 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 flex items-center gap-2 hover:gap-3 shadow-lg shadow-primary/25 active:scale-[0.98]"
                          >
                            Continue <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : authMode === "choose" ? (
                      <div className="flex-1 flex flex-col gap-5">
                        <button
                          onClick={() => {
                            setLoginError("");
                            // @ts-ignore
                            window.fikrStudio?.openAuth();
                          }}
                          className="w-full group relative overflow-hidden rounded-2xl border border-primary/30 bg-primary/5 hover:bg-primary/10 p-6 text-left transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_30px_rgba(var(--primary),0.15)]"
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                          <div className="relative z-10 flex items-center gap-5">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary shadow-inner">
                              <Cloud className="h-6 w-6" />
                            </div>
                            <div>
                              <h3 className="text-base font-bold text-foreground flex items-center gap-3">
                                Login to Fikr Cloud
                                <span className="text-[10px] uppercase font-black tracking-wider bg-primary text-primary-foreground px-2 py-0.5 rounded shadow-sm">Recommended</span>
                              </h3>
                              <p className="text-sm text-muted-foreground/80 mt-1">Unlock cloud sync, managed Vertex AI models, and MCP relay.</p>
                            </div>
                          </div>
                          {loginError && <p className="relative z-10 text-xs text-red-400 mt-4 font-mono bg-red-400/10 p-2 rounded border border-red-400/20">{loginError}</p>}
                        </button>

                        <div className="relative flex items-center py-2">
                          <div className="flex-grow border-t border-white/5"></div>
                          <span className="mx-4 text-[10px] font-mono font-bold text-muted-foreground/50 uppercase tracking-widest">OR</span>
                          <div className="flex-grow border-t border-white/5"></div>
                        </div>

                        <button
                          onClick={() => setAuthMode("byok")}
                          className="w-full group rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 p-6 text-left transition-all duration-300 hover:border-white/20"
                        >
                          <div className="flex items-center gap-5">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5 text-muted-foreground group-hover:text-foreground transition-colors">
                              <Key className="h-6 w-6" />
                            </div>
                            <div>
                              <h3 className="text-base font-bold text-foreground/80 group-hover:text-foreground transition-colors">Bring Your Own Key</h3>
                              <p className="text-sm text-muted-foreground/70 mt-1">Use OpenRouter, OpenAI, or Gemini APIs directly. Local only.</p>
                            </div>
                          </div>
                        </button>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col gap-5 animate-in fade-in slide-in-from-right-4 duration-500">
                        {/* BYOK Form */}
                        <div className="flex flex-col gap-2 relative">
                          <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Select Provider</label>
                          <button
                            onClick={() => setProviderOpen((v) => !v)}
                            className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3.5 text-left transition-all hover:bg-black/40 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50"
                          >
                            <span className="font-mono text-sm font-bold text-foreground/90">{currentPreset.label}</span>
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${providerOpen ? "rotate-180" : ""}`} />
                          </button>
                          <AnimatePresence>
                            {providerOpen && (
                              <motion.div 
                                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
                                className="absolute top-[76px] left-0 right-0 z-20 overflow-hidden rounded-xl border border-white/10 bg-background/95 backdrop-blur-xl shadow-2xl"
                              >
                                {AI_PROVIDER_PRESETS.map((preset) => (
                                  <button
                                    key={preset.id}
                                    onClick={() => { setDraftProvider(preset.id); setProviderOpen(false); }}
                                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                                  >
                                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${draftProvider === preset.id ? "border-primary bg-primary/20" : "border-white/10"}`}>
                                      {draftProvider === preset.id && <Check className="h-3.5 w-3.5 text-primary" />}
                                    </div>
                                    <span className="font-mono text-sm font-bold text-foreground/90">{preset.label}</span>
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <div className="flex flex-col gap-2 mt-2">
                          <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">API Key</label>
                          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3.5 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
                            <Key className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                            <input
                              type="text"
                              value={draftKey}
                              onChange={(e) => setDraftKey(e.target.value)}
                              placeholder={currentPreset.keyPlaceholder}
                              className="flex-1 bg-transparent font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
                              style={showKey ? undefined : ({ WebkitTextSecurity: "disc" } as never)}
                              autoComplete="off"
                              spellCheck={false}
                            />
                            <button onClick={() => setShowKey((v) => !v)} className="text-muted-foreground/60 hover:text-foreground transition-colors p-1">
                              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        <div className="mt-auto pt-8 flex justify-between items-center w-full">
                          <button
                            onClick={() => setAuthMode("choose")}
                            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-white/5"
                          >
                            ← Back
                          </button>
                          <button
                            onClick={handleSaveByok}
                            disabled={!draftKey.trim()}
                            className="px-6 py-3 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 hover:gap-3 shadow-lg shadow-primary/20 active:scale-[0.98]"
                          >
                            Save & Continue <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* STEP 3: NOTIFICATIONS */}
                {step === "notifications" && (
                  <motion.div
                    key="notifications"
                    initial={{ opacity: 0, filter: "blur(10px)", x: 20 }}
                    animate={{ opacity: 1, filter: "blur(0px)", x: 0 }}
                    exit={{ opacity: 0, filter: "blur(10px)", x: -20 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="flex flex-col h-full"
                  >
                    <div className="flex-1 flex flex-col items-center justify-center text-center gap-8 py-8">
                      <div className="relative group">
                        <div className="absolute -inset-6 bg-primary/20 rounded-full blur-2xl animate-pulse group-hover:bg-primary/30 transition-colors duration-500" />
                        <div className="relative h-24 w-24 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-[0_0_30px_rgba(var(--primary),0.2)] backdrop-blur-md">
                          <Bell className="h-10 w-10 animate-[wiggle_1s_ease-in-out_infinite]" style={{ animationIterationCount: 1, animationDelay: '0.5s' }} />
                        </div>
                      </div>
                      
                      <div>
                        <h2 className="text-3xl font-extrabold text-foreground mb-4 tracking-tight">Stay in the loop</h2>
                        <p className="text-muted-foreground/80 text-base max-w-[320px] mx-auto leading-relaxed">
                          Allow notifications to receive quiet, elegant updates when AI agents finish processing your spatial tasks.
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto pt-6 flex flex-col gap-3">
                      <button
                        onClick={handleRequestNotifications}
                        className="group w-full px-6 py-4 text-sm font-bold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-foreground/20 active:scale-[0.98] overflow-hidden relative"
                      >
                        <span className="relative z-10">Enable Notifications</span>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                      </button>
                      <button
                        onClick={onClose}
                        className="w-full px-6 py-3 text-sm font-semibold rounded-xl bg-transparent text-muted-foreground/70 hover:text-foreground hover:bg-white/5 transition-all duration-200"
                      >
                        Skip for now
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
