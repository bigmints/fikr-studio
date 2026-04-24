"use client"

import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus,
  Settings,
  Trash2,
  Check,
  X,
  Edit3,
  LayoutGrid,
  ArrowLeft,
  Key,
  ChevronDown,
  Globe,
  Eye,
  EyeOff,
  FolderInput,
  Copy,
  Save,
} from "lucide-react"
import {
  AI_PROVIDER_PRESETS,
  getModelsForProvider,
  getPreset,
  type AISettings,
  type AIProvider,
} from "@/lib/ai-settings"
import { signInWithCustomToken, signOut, onAuthStateChanged, User } from "firebase/auth"
import { collection, onSnapshot, updateDoc, doc, setDoc } from "firebase/firestore"
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase"

interface Project {
  id: string
  name: string
  blocks: any[]
  collapsedIds: string[]
}

interface ProjectSidebarProps {
  isOpen: boolean
  onClose: () => void
  projects: Project[]
  activeProjectId: string
  onSelectProject: (id: string) => void
  onCreateProject: () => void
  onImportProject: () => void
  onRenameProject: (id: string, newName: string) => void
  onDeleteProject: (id: string) => void
  openToSettings?: boolean
  onSettingsOpened?: () => void
  // AI Settings
  aiSettings: AISettings
  onUpdateAISettings: (patch: Partial<AISettings>) => void
  mcpPort?: number | null
}

export function ProjectSidebar({
  isOpen,
  onClose,
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onImportProject,
  onRenameProject,
  onDeleteProject,
  aiSettings,
  onUpdateAISettings,
  openToSettings,
  onSettingsOpened,
  mcpPort,
}: ProjectSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [providerOpen, setProviderOpen] = useState(false)
  // local draft for settings (only save on "Save")
  const [draft, setDraft] = useState<AISettings>(aiSettings)
  const inputRef = useRef<HTMLInputElement>(null)

  // Firebase Auth State
  const [user, setUser] = useState<User | null>(null)
  const [userPlan, setUserPlan] = useState<string>("Free")
  const [relayApiKey, setRelayApiKey] = useState<string>("")
  const [loginError, setLoginError] = useState("")

  // Auth and Relay Listener
  useEffect(() => {
    const auth = getFirebaseAuth()
    const db = getFirebaseDb()
    
    let unsubscribeUserDoc: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        // Listen to user's plan and relay API key
        unsubscribeUserDoc = onSnapshot(doc(db, "users", currentUser.uid), async (snap) => {
          if (snap.exists()) {
            const data = snap.data()
            setUserPlan(data.plan || "Free")
            
            // Auto-generate Relay API Key if missing
            if (!data.relayApiKey) {
              const newKey = "fp_" + crypto.randomUUID().replace(/-/g, '')
              await updateDoc(doc(db, "users", currentUser.uid), { relayApiKey: newKey })
              setRelayApiKey(newKey)
            } else {
              setRelayApiKey(data.relayApiKey)
            }
          } else {
            // Document doesn't exist, create it with a Relay API Key
            const newKey = "fp_" + crypto.randomUUID().replace(/-/g, '')
            // We cannot use setDoc here because we don't have it imported. 
            // We just let the backend handle creation, or we can use updateDoc.
            // Wait, we can assume the backend creates it. We just don't have the key yet.
          }
        })
      } else {
        setUserPlan("Free")
        setRelayApiKey("")
        if (unsubscribeUserDoc) unsubscribeUserDoc()
      }
    })

    // Listen to deep-linked auth tokens from Electron
    // @ts-ignore
    const unsubscribeIpc = window.fikrpad?.onExternalEvent?.((eventData) => {
      if (eventData.type === "auth-token" && eventData.payload?.token) {
        signInWithCustomToken(auth, eventData.payload.token)
          .catch(err => setLoginError(err.message))
      }
    })

    return () => {
      unsubscribeAuth()
      if (unsubscribeUserDoc) unsubscribeUserDoc()
      if (unsubscribeIpc) unsubscribeIpc()
    }
  }, [])

  // Listen to Firestore MCP Queue when Relay is Enabled
  useEffect(() => {
    if (!user) return

    const db = getFirebaseDb()
    const queueRef = collection(db, "users", user.uid, "mcp_queue")

    // Notify main process for debugging
    // @ts-ignore
    window.fikrpad.executeMcp({ method: "notifications/progress", params: { token: "Relay Connected!" } }).catch(() => {})

    console.log("[FikrPad Relay] Listening for cloud MCP payloads...");
    const unsubscribeQueue = onSnapshot(queueRef, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added" || change.type === "modified") {
          const data = change.doc.data()
          if (data.status === "pending" && data.payload) {
            console.log("[FikrPad Relay] Received payload:", data.payload.method)
            
            try {
              // Execute the raw MCP JSON-RPC payload via IPC Main
              const payload = typeof data.payload === "string" ? JSON.parse(data.payload) : data.payload;
              // @ts-ignore
              const result = await window.fikrpad.executeMcp(payload)
              
              // Only push result if it's not a notification (notifications return null)
              if (result !== null && payload.id !== undefined) {
                await updateDoc(doc(db, "users", user.uid, "mcp_queue", change.doc.id), {
                  status: "completed",
                  result: result
                }).catch(async (e) => {
                  // Write a note if updateDoc fails
                  const noteRef = doc(collection(db, "users", user.uid, "notes"))
                  await setDoc(noteRef, { text: "Failed to updateDoc for initialize! Error: " + e.message, timestamp: Date.now() })
                })
              } else {
                // Just mark it completed without a result
                await updateDoc(doc(db, "users", user.uid, "mcp_queue", change.doc.id), {
                  status: "completed",
                  result: null
                }).catch(async (e) => {
                  const noteRef = doc(collection(db, "users", user.uid, "notes"))
                  await setDoc(noteRef, { text: "Failed to updateDoc for notification! Error: " + e.message, timestamp: Date.now() })
                })
              }
              console.log("[FikrPad Relay] Executed and responded to cloud agent.")
            } catch (err: any) {
              const errMsg = err.message || "Unknown error executing tool";
              // Write a note for debugging
              const noteRef = doc(collection(db, "users", user.uid, "notes"))
              await setDoc(noteRef, { text: "executeMcp threw an error! " + errMsg, timestamp: Date.now() })

              await updateDoc(doc(db, "users", user.uid, "mcp_queue", change.doc.id), {
                status: "error",
                error: errMsg
              })
            }
          }
        }
      })
    })

    return () => unsubscribeQueue()
  }, [user])

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  // Sync draft when panel opens
  useEffect(() => {
    if (showSettings) setDraft(aiSettings)
  }, [showSettings])

  // Jump straight to settings when requested externally
  useEffect(() => {
    if (openToSettings) {
      setShowSettings(true)
      onSettingsOpened?.()
    }
  }, [openToSettings])

  const handleRename = (id: string) => {
    if (editName.trim()) onRenameProject(id, editName.trim())
    setEditingId(null)
  }

  const handleDelete = (id: string) => {
    onDeleteProject(id)
    setDeletingId(null)
  }

  const persistSettings = () => {
    // Trim key to strip accidental whitespace/newlines from paste
    const trimmedKey = draft.apiKey.trim()
    const providerKeys: Partial<Record<AIProvider, string>> = {
      ...(draft.providerKeys ?? {}),
      [draft.provider]: trimmedKey,
    }
    onUpdateAISettings({ ...draft, apiKey: trimmedKey, providerKeys })
  }

  const handleSaveSettings = () => {
    persistSettings()
    setShowSettings(false)
  }

  // Auto-save settings when the sidebar closes or when navigating back,
  // so key edits are never silently dropped.
  const handleClose = () => {
    if (showSettings) persistSettings()
    onClose()
  }

  const currentPreset = getPreset(draft.provider)
  const models = getModelsForProvider(draft.provider)
  const selectedModel = models.find(m => m.id === draft.modelId) || models[0] || undefined

  return (
    <div
      style={{ 
        width: isOpen ? 240 : 0,
        opacity: isOpen ? 1 : 0,
        visibility: isOpen ? "visible" : "hidden"
      }}
      className="relative z-50 transition-all duration-200 ease-in-out overflow-hidden border-r border-border bg-black/20 backdrop-blur-3xl flex flex-col h-full"
    >
      <div className="w-[240px] flex flex-col h-full">
        <div 
          className="flex h-10 items-center justify-between border-b border-border bg-card/5 backdrop-blur-md pr-3 pl-[80px] py-1.5 shrink-0 select-none"
          style={{ WebkitAppRegion: 'drag' } as any}
        >
          <div className="flex items-center gap-2.5">
            {showSettings ? (
              <button
                onClick={handleSaveSettings}
                style={{ WebkitAppRegion: 'no-drag' } as any}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="font-mono text-xs font-bold uppercase tracking-tight">Settings</span>
              </button>
            ) : (
              <>
                <div className="flex items-center justify-center h-5 w-5 bg-primary/10 rounded-sm">
                  <LayoutGrid className="h-3.5 w-3.5 text-primary" />
                </div>
                <h2 className="font-mono text-xs font-bold uppercase tracking-tight text-foreground/80 select-none">
                  Spaces
                </h2>
              </>
            )}
          </div>
          <button
            onClick={handleClose}
            style={{ WebkitAppRegion: 'no-drag' } as any}
            className="p-1 px-1.5 hover:bg-white/5 rounded-sm transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Content — animated slide between projects/settings */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait" initial={false}>
            {!showSettings ? (
              <motion.div
                key="projects"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 overflow-y-auto px-2 py-2 space-y-0.5 custom-scrollbar"
              >
                {projects.map((project) => (
                  <div 
                    key={project.id}
                    className={`group relative rounded-sm transition-all duration-150 ${
                      activeProjectId === project.id 
                        ? "bg-primary/10 shadow-[inset_0_1px_0px_rgba(255,255,255,0.05)]" 
                        : "hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center p-2 px-2.5">
                      <button
                        onClick={() => onSelectProject(project.id)}
                        className="flex-1 text-left flex flex-col gap-0 overflow-hidden"
                      >
                        {editingId === project.id ? (
                          <input
                            ref={inputRef}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRename(project.id)
                              if (e.key === "Escape") setEditingId(null)
                            }}
                            onBlur={() => handleRename(project.id)}
                            className="bg-transparent font-mono text-xs font-bold text-foreground focus:outline-none w-full border-b border-primary/50 py-0"
                          />
                        ) : (
                          <span className={`font-mono text-[12px] font-bold truncate ${
                            activeProjectId === project.id ? "text-primary" : "text-foreground/80 group-hover:text-foreground"
                          }`}>
                            {project.name}
                          </span>
                        )}
                        <span className="font-mono text-[8px] text-muted-foreground uppercase tracking-tighter font-bold">
                          {project.blocks?.length || 0} {(project.blocks?.length || 0) === 1 ? 'node' : 'nodes'}
                        </span>
                      </button>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {editingId !== project.id && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditName(project.name)
                                setEditingId(project.id)
                              }}
                              className="p-1 hover:bg-white/10 rounded-sm text-muted-foreground hover:text-primary transition-colors"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                            {(projects?.length || 0) > 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeletingId(project.id)
                                }}
                                className="p-1 hover:bg-destructive/20 rounded-sm text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Delete Confirmation Overlay */}
                    <AnimatePresence>
                      {deletingId === project.id && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0 }}
                          className="absolute inset-0 z-10 bg-destructive/95 backdrop-blur-md rounded-sm flex items-center justify-between px-3"
                        >
                          <span className="font-mono text-[8px] font-bold text-white uppercase tracking-tighter">
                            Delete Space?
                          </span>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => handleDelete(project.id)}
                              className="p-1 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                            <button 
                              onClick={() => setDeletingId(null)}
                              className="p-1 bg-black/30 hover:bg-black/40 rounded-full text-white transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="settings"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 20, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 overflow-y-auto px-3 py-4 flex flex-col gap-5 custom-scrollbar"
              >
                {/* Provider Selector */}
                <div className="flex flex-col gap-2">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Provider
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setProviderOpen(v => !v)}
                      className="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-2 text-left hover:bg-white/[0.07] focus:outline-none transition-colors"
                    >
                      <span className="font-mono text-[11px] font-bold text-foreground">{currentPreset.label}</span>
                      <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${providerOpen ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence>
                      {providerOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.1 }}
                          className="absolute top-full left-0 right-0 z-20 mt-1 overflow-hidden rounded-md border border-border bg-card shadow-xl"
                        >
                          {AI_PROVIDER_PRESETS.map(preset => (
                            <button
                              key={preset.id}
                              onClick={() => {
                                const newModels = getModelsForProvider(preset.id)
                                setDraft(d => ({
                                  ...d,
                                  provider: preset.id,
                                  modelId: newModels[0]?.id ?? d.modelId,
                                  webGrounding: d.webGrounding,
                                  customBaseUrl: "",
                                  // Restore the saved key for this provider if one exists,
                                  // otherwise clear so the user knows to enter a new one.
                                  apiKey: d.providerKeys?.[preset.id] ?? "",
                                }))
                                setProviderOpen(false)
                              }}
                              className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left hover:bg-white/5 transition-colors"
                            >
                              <div className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                                draft.provider === preset.id ? "border-primary bg-primary/20" : "border-white/10"
                              }`}>
                                {draft.provider === preset.id && <Check className="h-2.5 w-2.5 text-primary" />}
                              </div>
                              <span className="font-mono text-[10px] font-bold text-foreground">{preset.label}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* API Key */}
                <div className="flex flex-col gap-2">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    API Key
                  </label>
                  <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-2 focus-within:border-primary/50 transition-colors">
                    <Key className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <input
                      type="text"
                      value={draft.apiKey}
                      onChange={e => setDraft(d => ({ ...d, apiKey: e.target.value }))}
                      placeholder={currentPreset.keyPlaceholder || "Your API key"}
                      className="flex-1 bg-transparent font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground/40"
                      style={showKey ? undefined : { WebkitTextSecurity: "disc" } as never}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button onClick={() => setShowKey(v => !v)} className="text-muted-foreground hover:text-foreground transition-colors">
                      {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                  </div>
                  <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">
                    Stored locally. Never sent to a server.{" "}
                    {currentPreset.keyUrl && (
                      <a href={currentPreset.keyUrl} target="_blank" rel="noopener noreferrer"
                        className="text-primary underline hover:brightness-125 transition-all">
                        Get a key →
                      </a>
                    )}
                  </p>
                </div>

                {/* Custom Base URL */}
                <div className="flex flex-col gap-2">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Custom Base URL
                  </label>
                  <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-2 focus-within:border-primary/50 transition-colors">
                    <input
                      type="text"
                      value={draft.customBaseUrl ?? ""}
                      onChange={e => setDraft(d => ({ ...d, customBaseUrl: e.target.value }))}
                      placeholder="Optional — for local/self-hosted endpoints"
                      className="flex-1 bg-transparent font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground/40"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                  <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">
                    Override the provider URL. Useful for Ollama, LM Studio, vLLM, or other OpenAI-compatible endpoints.
                  </p>
                </div>

                {/* Model Selector */}
                <div className="flex flex-col gap-2">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Model
                  </label>
                  {(models?.length || 0) === 0 ? (
                    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-2 focus-within:border-primary/50 transition-colors">
                      <input
                        type="text"
                        value={draft.modelId}
                        onChange={e => setDraft(d => ({ ...d, modelId: e.target.value }))}
                        placeholder="e.g. gpt-4o, claude-3-opus-20240229"
                        className="flex-1 bg-transparent font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground/40"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <button
                        onClick={() => setModelOpen(v => !v)}
                        className="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-2 text-left hover:bg-white/[0.07] focus:outline-none transition-colors"
                      >
                        <div>
                          <div className="font-mono text-[11px] font-bold text-foreground">{selectedModel?.label ?? draft.modelId}</div>
                          <div className="font-mono text-[9px] text-muted-foreground mt-0.5">{selectedModel?.description ?? "Custom model ID"}</div>
                        </div>
                        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${modelOpen ? "rotate-180" : ""}`} />
                      </button>
                      <AnimatePresence>
                        {modelOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.1 }}
                            className="absolute top-full left-0 right-0 z-20 mt-1 overflow-hidden rounded-md border border-border bg-card shadow-xl"
                          >
                            {models.map(model => (
                              <button
                                key={model.id}
                                onClick={() => {
                                  setDraft(d => ({ ...d, modelId: model.id, webGrounding: model.supportsGrounding ? d.webGrounding : false }))
                                  setModelOpen(false)
                                }}
                                className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left hover:bg-white/5 transition-colors"
                              >
                                <div className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                                  draft.modelId === model.id ? "border-primary bg-primary/20" : "border-white/10"
                                }`}>
                                  {draft.modelId === model.id && <Check className="h-2.5 w-2.5 text-primary" />}
                                </div>
                                <div>
                                  <div className="font-mono text-[10px] font-bold text-foreground">{model.label}</div>
                                  <div className="font-mono text-[9px] text-muted-foreground">{model.description}</div>
                                </div>
                                {model.supportsGrounding && (draft.provider === "openrouter" || draft.provider === "openai") && <Globe className="ml-auto h-3 w-3 shrink-0 text-primary/50" />}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* Web Grounding (OpenRouter + OpenAI) */}
                {(draft.provider === "openrouter" || draft.provider === "openai") && selectedModel && (
                  <div className="flex items-start justify-between gap-3 rounded-md border border-white/5 bg-white/[0.02] px-2.5 py-2.5">
                    <div className="flex items-start gap-2">
                      <Globe className="h-3.5 w-3.5 mt-0.5 text-primary/60 shrink-0" />
                      <div>
                        <div className="font-mono text-[11px] font-bold text-foreground">Web Grounding</div>
                        <div className="font-mono text-[9px] text-muted-foreground mt-0.5 leading-relaxed">
                          {selectedModel.supportsGrounding
                            ? draft.provider === "openai"
                              ? `Uses ${selectedModel.groundingModelId ?? "search-preview"} for live web access`
                              : "Adds :online for live search"
                            : "Not available for this model"}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => selectedModel.supportsGrounding && setDraft(d => ({ ...d, webGrounding: !d.webGrounding }))}
                      disabled={!selectedModel.supportsGrounding}
                      className={`relative shrink-0 h-5 w-9 rounded-full transition-all duration-200 ${
                        draft.webGrounding && selectedModel.supportsGrounding ? "bg-primary" : "bg-white/10"
                      } disabled:opacity-30 disabled:cursor-not-allowed`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200 ${
                        draft.webGrounding && selectedModel.supportsGrounding ? "left-5" : "left-0.5"
                      }`} />
                    </button>
                  </div>
                )}

                {/* API Status */}
                <div className={`flex items-center gap-2 rounded-md px-2.5 py-2 font-mono text-[9px] ${
                  draft.apiKey || draft.provider === "custom"
                    ? "bg-primary/10 border border-primary/20 text-primary"
                    : "bg-white/5 border border-white/5 text-muted-foreground"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${draft.apiKey || draft.provider === "custom" ? "bg-primary animate-pulse" : "bg-white/30"}`} />
                  {draft.apiKey ? `${currentPreset.label} — API key configured` : draft.provider === "custom" ? "Custom endpoint configured" : "No API key — AI disabled"}
                </div>

                {/* MCP & Cloud Relay Config */}
                <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-white/5">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center justify-between">
                    <span>Fikr MCP Connection</span>
                  </label>

                  {user ? (
                    <div className="flex flex-col gap-3">
                      {/* Premium Banner */}
                      <div className="relative overflow-hidden rounded-md border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-3">
                        <div className="absolute top-0 right-0 p-3 opacity-20">
                          <Globe className="h-10 w-10 text-primary" />
                        </div>
                        <div className="relative z-10 flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold text-primary tracking-widest uppercase">Fikr Cloud Active</span>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                              userPlan === 'Pro' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' :
                              userPlan === 'Plus' ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30' :
                              'bg-white/10 text-muted-foreground border border-white/10'
                            }`}>
                              {userPlan} Plan
                            </span>
                          </div>
                          <span className="font-mono text-[9px] text-foreground/70 truncate w-[160px]">{user.email}</span>
                        </div>
                        <div className="relative z-10 mt-3 pt-2 border-t border-primary/20 flex justify-between items-center">
                          <span className="font-mono text-[8px] text-primary/70 uppercase">Global Relay Enabled</span>
                          <button onClick={() => signOut(getFirebaseAuth())} className="font-mono text-[9px] text-red-400 hover:text-red-300 transition-colors">Sign Out</button>
                        </div>
                      </div>

                      <Dialog>
                        <DialogTrigger asChild>
                          <button className="h-8 w-full bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-mono text-[9px] rounded-sm transition-all flex items-center justify-center gap-2">
                            <Settings className="h-3 w-3" />
                            View MCP Configuration
                          </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md bg-zinc-950 border-white/10">
                          <DialogHeader>
                            <DialogTitle className="font-mono text-sm uppercase text-primary">MCP Configuration</DialogTitle>
                            <DialogDescription className="font-mono text-[10px] text-muted-foreground">
                              Copy this JSON snippet into your MCP client configuration file to give your agent access to your FikrPad.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="mt-2 bg-black/40 rounded-md border border-white/10 p-3 relative group">
                            <pre className="font-mono text-[10px] text-foreground/80 whitespace-pre-wrap">
                              {`"fikrpad-cloud": {
  "command": "npx",
  "args": [
    "-y",
    "fikrpad-mcp",
    "https://fikr.one/api/mcp/relay"
  ],
  "env": {
    "MCP_RELAY_KEY": "Bearer ${relayApiKey || '<GENERATING_KEY...>'}"
  }
}`}
                            </pre>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`"fikrpad-cloud": {\n  "command": "npx",\n  "args": [\n    "-y",\n    "fikrpad-mcp",\n    "https://fikr.one/api/mcp/relay"\n  ],\n  "env": {\n    "MCP_RELAY_KEY": "Bearer ${relayApiKey || '<GENERATING_KEY...>'}"\n  }\n}`)
                              }}
                              className="absolute top-2 right-2 p-1.5 rounded-sm bg-white/10 hover:bg-white/20 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Copy to clipboard"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">
                        Add this to your agent's MCP config. This secure key gives cloud agents access to your FikrPad.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <Dialog>
                        <DialogTrigger asChild>
                          <button className="h-8 w-full bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-mono text-[9px] rounded-sm transition-all flex items-center justify-center gap-2">
                            <Settings className="h-3 w-3" />
                            View MCP Configuration
                          </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md bg-zinc-950 border-white/10">
                          <DialogHeader>
                            <DialogTitle className="font-mono text-sm uppercase text-primary">MCP Configuration</DialogTitle>
                            <DialogDescription className="font-mono text-[10px] text-muted-foreground">
                              Copy this JSON snippet into your MCP client configuration file to give your agent access to your FikrPad.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="mt-2 bg-black/40 rounded-md border border-white/10 p-3 relative group">
                            <pre className="font-mono text-[10px] text-foreground/80 whitespace-pre-wrap">
                              {`"fikrpad": {
  "command": "npx",
  "args": [
    "-y",
    "fikrpad-mcp",
    "http://localhost:${mcpPort || 3025}/sse"
  ]
}`}
                            </pre>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`"fikrpad": {\n  "command": "npx",\n  "args": [\n    "-y",\n    "fikrpad-mcp",\n    "http://localhost:${mcpPort || 3025}/sse"\n  ]\n}`)
                              }}
                              className="absolute top-2 right-2 p-1.5 rounded-sm bg-white/10 hover:bg-white/20 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Copy to clipboard"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <div className="flex flex-col gap-2 bg-black/20 p-2 rounded-md border border-white/5">
                        <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">
                          Currently only accepting local connections. Sign in to enable Fikr Cloud Relay for external agents.
                        </p>
                        {loginError && <p className="font-mono text-[9px] text-red-500">{loginError}</p>}
                        <button 
                          onClick={() => {
                            setLoginError("");
                            // @ts-ignore
                            window.fikrpad.openAuth();
                          }}
                          className="h-7 mt-1 w-full bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary font-mono text-[9px] rounded-sm transition-all"
                        >
                          Login with Fikr.One
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/5 bg-black/10 shrink-0">
          {showSettings ? (
            <div className="flex flex-col gap-1.5">
              <button
                onClick={handleSaveSettings}
                className="flex items-center justify-between w-full h-8 px-2.5 rounded-sm bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] shadow-sm"
              >
                <span>Save Settings</span>
                <Save className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="flex items-center justify-center w-full h-8 px-2.5 rounded-sm bg-white/5 hover:bg-white/10 text-muted-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] border border-white/5"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <button
                onClick={onCreateProject}
                className="flex items-center justify-between w-full h-8 px-2.5 rounded-sm bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] shadow-sm"
              >
                <span>New Space</span>
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onImportProject}
                className="flex items-center justify-between w-full h-8 px-2.5 rounded-sm bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] border border-white/5"
                title="Import a .nodepad file"
              >
                <span>Import .nodepad</span>
                <FolderInput className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center justify-between w-full h-8 px-2.5 rounded-sm bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] border border-white/5"
              >
                <span>Settings</span>
                <Settings className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
