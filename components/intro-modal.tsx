"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Cloud, Key, ChevronDown, Check, Bell, ChevronRight, Eye, EyeOff, Sparkles, Wand2 } from "lucide-react"
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase"
import { onAuthStateChanged, User, signInWithCustomToken } from "firebase/auth"
import { doc, onSnapshot } from "firebase/firestore"
import { useAISettings, AI_PROVIDER_PRESETS, type AIProvider, getPreset } from "@/lib/ai-settings"
import { analytics } from "@/lib/analytics"
import pkg from "../package.json"

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

  const prevOpen = useRef(false)
  
  useEffect(() => {
    if (open && !prevOpen.current) {
      setStep("intro")
      setAuthMode("choose")
      setDraftProvider(settings.provider)
      setDraftKey(settings.apiKey)
    }
    prevOpen.current = open;
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

    // @ts-expect-error - IPC method
    const unsubscribeIpc = window.fikrStudio?.onExternalEvent?.((eventData: any) => {
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
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[500] flex p-4 sm:p-6"
        >
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => onClose()}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative m-auto w-full max-w-[500px] bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
            style={{ minHeight: "480px" }}
          >
            {/* Header */}
            <div className="relative z-10 flex items-center justify-between px-6 pt-6 pb-2 shrink-0">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
                    <img src="./logo-icon.png" alt="Fikr Studio" className="h-4 w-4 object-contain brightness-0 invert" />
                  </div>
                  <span className="font-semibold text-lg text-foreground tracking-tight">Fikr Studio</span>
                  <span className="text-xs font-medium text-muted-foreground ml-1">v{pkg.version}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  {steps.map((s, idx) => (
                    <div
                      key={s}
                      className={`h-1 rounded-full transition-all duration-300 ${
                        idx <= currentStepIndex ? "w-8 bg-primary" : "w-4 bg-muted"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content Area */}
            <div className="relative z-10 flex-1 px-6 py-4 flex flex-col">
              <AnimatePresence mode="wait">
                {/* STEP 1: INTRO */}
                {step === "intro" && (
                  <motion.div
                    key="intro"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col h-full"
                  >
                    <h2 className="text-2xl font-bold text-foreground mb-3">
                      Intelligence emerges.
                    </h2>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                      Fikr Studio is your spatial thinking environment. Capture raw thoughts, and watch as AI automatically categorises, annotates, and weaves them together in real-time.
                    </p>
                    
                    <div className="space-y-4 flex-1">
                      <div className="flex items-start gap-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted border border-border text-foreground shadow-sm">
                          <Wand2 className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-foreground text-sm font-semibold mb-0.5">Zero-friction capture</h3>
                          <p className="text-xs text-muted-foreground leading-relaxed">No folders. No tags. Just type and hit enter. The engine structures everything seamlessly.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted border border-border text-foreground shadow-sm">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-foreground text-sm font-semibold mb-0.5">Infinite spatial canvas</h3>
                          <p className="text-xs text-muted-foreground leading-relaxed">See the shape of your thoughts. Navigate visually and let unexpected connections surface.</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 flex justify-end">
                      <button
                        onClick={() => setStep("auth")}
                        className="px-5 py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm"
                      >
                        Configure Engine <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* STEP 2: AUTH */}
                {step === "auth" && (
                  <motion.div
                    key="auth"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col h-full"
                  >
                    {authMode === "choose" ? (
                      <div className="flex flex-col h-full">
                        <div className="mb-6">
                          <h2 className="text-2xl font-bold text-foreground mb-2">Connect Intelligence</h2>
                          <p className="text-sm text-muted-foreground">
                            Choose how Fikr Studio powers its AI capabilities. You can always change this later in Settings.
                          </p>
                        </div>

                        <div className="flex flex-col gap-4 mb-6 mt-8">
                          <button 
                            onClick={() => {
                              if (user) setStep("notifications");
                              else (window as any).fikrStudio?.openAuth?.();
                            }}
                            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-sm"
                          >
                            <Cloud className="h-5 w-5" />
                            {user ? "Continue with Fikr Cloud" : "Sign in with Fikr Cloud"}
                          </button>
                          
                          {loginError && <p className="text-xs text-red-500 text-center -mt-2">{loginError}</p>}

                          <button 
                            onClick={() => setAuthMode("byok")}
                            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-transparent border border-border text-foreground rounded-xl font-medium hover:bg-muted transition-colors"
                          >
                            <Key className="h-5 w-5 text-muted-foreground" />
                            Use your own AI API key
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col h-full">
                        <div className="mb-6">
                          <h2 className="text-2xl font-bold text-foreground mb-2">Local Configuration</h2>
                          <p className="text-sm text-muted-foreground">
                            Configure your local provider. API keys are stored securely on your machine.
                          </p>
                        </div>

                        <div className="relative mb-4">
                          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Provider</label>
                          <button
                            onClick={() => setProviderOpen(v => !v)}
                            className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-left hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                          >
                            <span className="text-sm font-medium text-foreground">{currentPreset.label}</span>
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${providerOpen ? "rotate-180" : ""}`} />
                          </button>
                          <AnimatePresence>
                            {providerOpen && (
                              <motion.div 
                                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
                                className="absolute top-[64px] left-0 right-0 z-20 overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
                              >
                                {AI_PROVIDER_PRESETS.map((preset) => (
                                  <button
                                    key={preset.id}
                                    onClick={() => { setDraftProvider(preset.id); setProviderOpen(false); }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted transition-colors"
                                  >
                                    <div className="w-4 flex justify-center">
                                      {draftProvider === preset.id && <Check className="h-3 w-3 text-primary" />}
                                    </div>
                                    <span className="text-sm font-medium">{preset.label}</span>
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <div className="mb-4">
                          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">API Key</label>
                          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/50">
                            <Key className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <input
                              type="text"
                              value={draftKey}
                              onChange={(e) => setDraftKey(e.target.value)}
                              placeholder={currentPreset.keyPlaceholder}
                              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
                              style={showKey ? undefined : ({ WebkitTextSecurity: "disc" } as never)}
                              autoComplete="off"
                              spellCheck={false}
                            />
                            <button onClick={() => setShowKey((v) => !v)} className="text-muted-foreground hover:text-foreground">
                              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        <div className="mt-auto pt-6 flex justify-between items-center w-full">
                          <button
                            onClick={() => setAuthMode("choose")}
                            className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted transition-colors"
                          >
                            <ChevronRight className="h-4 w-4 rotate-180" /> Back
                          </button>
                          <button
                            onClick={handleSaveByok}
                            disabled={!draftKey.trim()}
                            className="px-5 py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
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
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col h-full"
                  >
                    <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 py-6">
                      <div className="h-16 w-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
                        <Bell className="h-7 w-7" />
                      </div>
                      
                      <div>
                        <h2 className="text-xl font-bold text-foreground mb-2">Stay in the loop</h2>
                        <p className="text-muted-foreground text-sm max-w-[280px] mx-auto leading-relaxed">
                          Allow notifications to receive quiet, elegant updates when AI agents finish processing your spatial tasks.
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto pt-4 flex flex-col gap-2">
                      <button
                        onClick={handleRequestNotifications}
                        className="w-full px-5 py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                      >
                        Enable Notifications
                      </button>
                      <button
                        onClick={onClose}
                        className="w-full px-5 py-2.5 text-sm font-medium rounded-lg bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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
