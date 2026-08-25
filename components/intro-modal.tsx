"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Cloud, Key, ChevronDown, Check, Bell, ChevronRight, Eye, EyeOff, Sparkles, Wand2 } from "lucide-react"
import { getFirebaseAuth } from "@/lib/firebase"
import { onIdTokenChanged, User, signInWithCustomToken } from "firebase/auth"
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

  // Firebase auth listener; plan authority comes from verified fikr.one APIs.
  useEffect(() => {
    const auth = getFirebaseAuth()

    const unsubscribeAuth = onIdTokenChanged(auth, async (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        const token = await currentUser.getIdToken().catch(() => null)
        const ipc = (window as any).fikrStudio
        const profile = token && ipc?.setUser
          ? await ipc.setUser(currentUser.uid, token).catch(() => null)
          : null
        setUserPlan(profile?.plan || "Free")
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
            className="absolute inset-0 bg-black/45"
            onClick={() => onClose()}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative m-auto flex w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-border/70 bg-background shadow-[0_32px_90px_rgba(0,0,0,0.28)]"
            style={{ minHeight: "min(520px, calc(100vh - 32px))", maxHeight: "calc(100vh - 32px)" }}
          >
            {/* Header */}
            <div className="relative z-10 flex items-start justify-between px-6 pt-6 sm:px-8 sm:pt-7 shrink-0">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg bg-foreground" aria-hidden="true">
                    <span
                      className="h-5 w-5 bg-background"
                      style={{
                        WebkitMask: "url('/logo.svg') center / contain no-repeat",
                        mask: "url('/logo.svg') center / contain no-repeat",
                      }}
                    />
                  </div>
                  <span className="font-serif text-xl font-medium text-foreground tracking-tight">Fikr</span>
                  <span className="text-xs text-muted-foreground">v{pkg.version}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-4" aria-label={`Step ${currentStepIndex + 1} of ${steps.length}`}>
                  {steps.map((s, idx) => (
                    <div
                      key={s}
                      className={`h-0.5 transition-all duration-300 ${
                        idx <= currentStepIndex ? "w-8 bg-foreground" : "w-5 bg-border"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={onClose}
                className="min-h-8 px-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Skip setup"
              >
                Skip
              </button>
            </div>

            {/* Content Area */}
            <div className="relative z-10 flex flex-1 flex-col overflow-y-auto px-6 pb-6 pt-8 sm:px-8 sm:pb-8 sm:pt-10">
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
                    <h2 className="font-serif text-3xl font-medium leading-none tracking-tight text-foreground mb-3">
                      Your thinking, in one place.
                    </h2>
                    <p className="max-w-[460px] text-muted-foreground text-sm leading-relaxed mb-8">
                      Capture notes without an account. Add AI only when it is useful, using your own provider or a Fikr plan.
                    </p>
                    
                    <div className="space-y-5 flex-1">
                      <div className="flex items-start gap-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                          <Wand2 className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-foreground text-sm font-semibold mb-1">Local by default</h3>
                          <p className="text-xs text-muted-foreground leading-relaxed">Your workspace stays useful without sign-in or an AI connection.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-foreground text-sm font-semibold mb-1">One workspace, multiple views</h3>
                          <p className="text-xs text-muted-foreground leading-relaxed">Read in an inbox, explore connections, and return to the source at any time.</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 flex justify-end">
                      <button
                        onClick={() => setStep("auth")}
                        className="min-h-10 px-5 text-sm font-medium rounded-md bg-foreground text-background hover:opacity-90 transition-opacity flex items-center gap-2"
                      >
                        Continue <ChevronRight className="h-4 w-4" />
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
                          <h2 className="font-serif text-3xl font-medium leading-none tracking-tight text-foreground mb-3">Choose how AI works.</h2>
                          <p className="max-w-[440px] text-sm leading-relaxed text-muted-foreground">
                            Sign in for managed AI and sync, or connect your own provider. You can change this later.
                          </p>
                        </div>

                        <div className="flex flex-col gap-3 mb-6 mt-8">
                          <button 
                            onClick={() => {
                              if (user) setStep("notifications");
                              else (window as any).fikrStudio?.openAuth?.();
                            }}
                            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 font-medium text-background transition-opacity hover:opacity-90"
                          >
                            <Cloud className="h-5 w-5" />
                            {user ? "Continue with Fikr Cloud" : "Sign in with Fikr Cloud"}
                          </button>
                          
                          {loginError && <p className="text-xs text-red-500 text-center -mt-2">{loginError}</p>}

                          <button 
                            onClick={() => setAuthMode("byok")}
                            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-border/80 bg-background px-4 font-medium text-foreground transition-colors hover:bg-muted"
                          >
                            <Key className="h-5 w-5 text-muted-foreground" />
                            Use your own AI API key
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col h-full">
                        <div className="mb-6">
                          <h2 className="font-serif text-3xl font-medium leading-none tracking-tight text-foreground mb-3">Use your own provider.</h2>
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            Your API key is stored securely on this Mac and is never synced to Fikr.
                          </p>
                        </div>

                        <div className="relative mb-4">
                          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Provider</label>
                          <button
                            onClick={() => setProviderOpen(v => !v)}
                            className="flex min-h-11 w-full items-center justify-between rounded-md border border-border/80 bg-background px-3.5 text-left hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-foreground/30"
                          >
                            <span className="text-sm font-medium text-foreground">{currentPreset.label}</span>
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${providerOpen ? "rotate-180" : ""}`} />
                          </button>
                          <AnimatePresence>
                            {providerOpen && (
                              <motion.div 
                                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
                                className="absolute top-[64px] left-0 right-0 z-20 overflow-hidden rounded-lg border border-border/80 bg-popover p-1.5 shadow-xl"
                              >
                                {AI_PROVIDER_PRESETS.map((preset) => (
                                  <button
                                    key={preset.id}
                                    onClick={() => { setDraftProvider(preset.id); setProviderOpen(false); }}
                                    className="flex min-h-9 w-full items-center gap-2 rounded-md px-2.5 text-left hover:bg-muted transition-colors"
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
                          <div className="flex min-h-11 items-center gap-2 rounded-md border border-border/80 bg-background px-3.5 focus-within:ring-1 focus-within:ring-foreground/30">
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
                            className="min-h-10 px-5 text-sm font-medium rounded-md bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
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
                    <div className="flex flex-1 flex-col justify-center gap-7 py-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-foreground text-background">
                        <Bell className="h-5 w-5" />
                      </div>
                      
                      <div className="max-w-[440px]">
                        <h2 className="font-serif text-3xl font-medium leading-none tracking-tight text-foreground mb-3">Notifications, when useful.</h2>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          Get a quiet alert when background work finishes. No marketing notifications.
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto pt-4 flex flex-col gap-2">
                      <button
                        onClick={handleRequestNotifications}
                        className="min-h-11 w-full px-5 text-sm font-medium rounded-md bg-foreground text-background hover:opacity-90 transition-opacity"
                      >
                        Allow notifications
                      </button>
                      <button
                        onClick={onClose}
                        className="min-h-10 w-full px-5 text-sm font-medium rounded-md bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        Not now
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
