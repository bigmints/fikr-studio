"use client"

import { useState, useEffect, useCallback } from "react"
import { getFirebaseAuth, getFirebaseDb } from "./firebase"
import { doc, getDoc } from "firebase/firestore"

// ── Provider types ────────────────────────────────────────────────────────────

export type AIProvider = "openai" | "gemini" | "openrouter"

// ── Task presets ──────────────────────────────────────────────────────────────
// Named @preset/fikr-<task>. Holds cost-effective recommended model IDs
// for each provider. null = not applicable (custom uses customModelName).

export type AITask = "analysis" | "tools" | "transcription" | "vision" | "embedding"

export const TASK_PRESET_NAMES: Record<AITask, string> = {
  analysis:      "@preset/fikr-analysis",
  tools:         "@preset/fikr-tools",
  transcription: "@preset/fikr-transcription",
  vision:        "@preset/fikr-vision",
  embedding:     "@preset/fikr-embedding",
}

/** Recommended cost-effective model per task per provider. */
export const PRESET_MODELS: Record<AITask, Record<AIProvider, string>> = {
  analysis: {
    openai:     "gpt-4o-mini",
    gemini:     "gemini-2.0-flash-lite",
    openrouter: "google/gemini-2.0-flash-lite-001",
  },
  tools: {
    openai:     "gpt-4o-mini",
    gemini:     "gemini-2.0-flash-lite",
    openrouter: "google/gemini-2.0-flash-lite-001",
  },
  transcription: {
    openai:     "whisper-1",
    gemini:     "gemini-2.0-flash",
    openrouter: "openai/whisper-large-v3",
  },
  vision: {
    openai:     "gpt-4o-mini",
    gemini:     "gemini-2.0-flash",
    openrouter: "google/gemini-2.0-flash-lite-001",
  },
  embedding: {
    openai:     "text-embedding-3-small",
    gemini:     "text-embedding-004",
    openrouter: "openai/text-embedding-3-small",
  },
}

/** Available model IDs per task per provider (for the settings picker). */
export const AVAILABLE_MODELS: Record<AITask, Partial<Record<AIProvider, string[]>>> = {
  analysis: {
    openai:     ["gpt-4o-mini", "gpt-4o", "gpt-4.1", "gpt-4.1-mini", "o4-mini"],
    gemini:     ["gemini-2.0-flash-lite", "gemini-2.0-flash", "gemini-2.5-pro-preview-03-25", "gemini-1.5-pro"],
    openrouter: [
      "google/gemini-2.0-flash-lite-001",
      "google/gemini-2.5-pro-preview-03-25",
      "anthropic/claude-sonnet-4-5",
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "deepseek/deepseek-chat",
      "mistralai/mistral-small-3.2-24b-instruct",
      "nvidia/nemotron-3-super-120b-a12b:free",
    ],
  },
  tools: {
    openai:     ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
    gemini:     ["gemini-2.0-flash-lite", "gemini-2.0-flash"],
    openrouter: ["google/gemini-2.0-flash-lite-001", "openai/gpt-4o-mini", "deepseek/deepseek-chat"],
  },
  transcription: {
    openai:     ["whisper-1", "gpt-4o-transcribe", "gpt-4o-mini-transcribe"],
    gemini:     ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro"],
    openrouter: ["openai/whisper-large-v3", "openai/gpt-4o-transcribe"],
  },
  vision: {
    openai:     ["gpt-4o-mini", "gpt-4o", "gpt-4.1"],
    gemini:     ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.5-pro-preview-03-25"],
    openrouter: [
      "google/gemini-2.0-flash-lite-001",
      "google/gemini-2.0-flash-001",
      "openai/gpt-4o-mini",
      "anthropic/claude-sonnet-4-5",
    ],
  },
  embedding: {
    openai:     ["text-embedding-3-small", "text-embedding-3-large", "text-embedding-ada-002"],
    gemini:     ["text-embedding-004", "gemini-embedding-exp-03-07"],
    openrouter: ["openai/text-embedding-3-small", "openai/text-embedding-3-large"],
  },
}

// ── Provider presets ──────────────────────────────────────────────────────────

export interface AIProviderPreset {
  id:             AIProvider
  label:          string
  baseUrl:        string
  keyUrl:         string
  keyPlaceholder: string
}

export const AI_PROVIDER_PRESETS: AIProviderPreset[] = [
  {
    id:             "openrouter",
    label:          "OpenRouter",
    baseUrl:        "https://openrouter.ai/api/v1",
    keyUrl:         "https://openrouter.ai/settings/keys",
    keyPlaceholder: "sk-or-v1-...",
  },
  {
    id:             "openai",
    label:          "OpenAI",
    baseUrl:        "https://api.openai.com/v1",
    keyUrl:         "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-...",
  },
  {
    id:             "gemini",
    label:          "Google Gemini",
    baseUrl:        "https://generativelanguage.googleapis.com/v1beta",
    keyUrl:         "https://aistudio.google.com/app/apikey",
    keyPlaceholder: "AIza...",
  },
]

export function getPreset(provider: AIProvider): AIProviderPreset {
  return AI_PROVIDER_PRESETS.find(p => p.id === provider) ?? AI_PROVIDER_PRESETS[0]
}

// ── Per-task model overrides ──────────────────────────────────────────────────
// null → use the preset default for the active provider.

export interface AITaskModels {
  analysis:      string | null
  tools:         string | null
  transcription: string | null
  vision:        string | null
  embedding:     string | null
}

const DEFAULT_TASK_MODELS: AITaskModels = {
  analysis:      null,
  tools:         null,
  transcription: null,
  vision:        null,
  embedding:     null,
}

// ── Settings shape ────────────────────────────────────────────────────────────

export interface AISettings {
  provider:        AIProvider
  apiKey:          string
  taskModels:      AITaskModels
  webGrounding:    boolean
}

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = "fikr-ai-settings"

const DEFAULT_SETTINGS: AISettings = {
  provider:        "openrouter",
  apiKey:          "",
  taskModels:      DEFAULT_TASK_MODELS,
  webGrounding:    false,
}

/** Migrate from old settings shape (flat modelId, zai provider, providerKeys). */
function migrate(raw: Record<string, any>): AISettings {
  let provider = raw.provider as AIProvider
  // zai was removed → fall back to openrouter
  if ((provider as string) === "zai") provider = "openrouter"
  // Legacy 'google' from old Flutter-side naming
  if ((provider as string) === "google") provider = "gemini"

  return {
    provider:        provider || DEFAULT_SETTINGS.provider,
    // Prefer new field; fall back to old providerKeys store, then bare apiKey
    apiKey:          raw.apiKey || raw.providerKeys?.[raw.provider] || "",
    taskModels:      raw.taskModels ? { ...DEFAULT_TASK_MODELS, ...raw.taskModels } : DEFAULT_TASK_MODELS,
    webGrounding:    raw.webGrounding ?? false,
  }
}

function loadSettings(): AISettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS
  try {
    // Try new key, then old key for migration
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem("nodepad-ai-settings")
    if (!raw) return DEFAULT_SETTINGS
    return migrate(JSON.parse(raw))
  } catch {
    return DEFAULT_SETTINGS
  }
}

// ── Resolved config (ready to use in AI calls) ────────────────────────────────

export interface AIConfig {
  provider:        AIProvider
  apiKey:          string
  taskModels:      AITaskModels
  supportsGrounding: boolean
}

export function loadAIConfig(): AIConfig | null {
  const s = loadSettings()
  if (!s.apiKey) return null
  return {
    provider:        s.provider,
    apiKey:          s.apiKey,
    taskModels:      s.taskModels,
    // Grounding only supported on openrouter for now
    supportsGrounding: s.provider === "openrouter" && s.webGrounding,
  }
}

/**
 * Resolve the effective model ID for a given task.
 * Priority: explicit task override → preset default → custom model name.
 */
export function resolveModel(config: AIConfig, task: AITask): string {
  const override = config.taskModels[task]
  if (override) return override
  return PRESET_MODELS[task][config.provider] ?? ""
}

export function getBaseUrl(config: AIConfig): string {
  return getPreset(config.provider).baseUrl
}

export function getProviderHeaders(config: AIConfig): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`
  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://fikr.one"
    headers["X-Title"] = "Fikr Studio"
  }
  // Gemini REST uses ?key= query param — caller handles auth separately.
  // We still pass the header for completeness but Gemini ignores it gracefully.
  return headers
}

// ── Legacy shim (used by components not yet migrated) ────────────────────────
// Returns the analysis model + metadata in the shape that page.tsx expects.

export function getModelsForProvider(_provider: AIProvider) {
  // Returns an empty array — settings modal now renders per-task pickers.
  return []
}

// ── Fikr Cloud Pro Managed Auth ───────────────────────────────────────────────

export async function getManagedAuthStatus(): Promise<{ isManaged: boolean; token: string | null }> {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser
    if (!user) return { isManaged: false, token: null }
    
    const db = getFirebaseDb()
    const userDoc = await getDoc(doc(db, "users", user.uid))
    if (!userDoc.exists()) return { isManaged: false, token: null }
    
    const plan = (userDoc.data()?.plan as string) || "Free"
    const isPro = plan.toLowerCase().includes("pro") || plan.toLowerCase().includes("plus")
    
    if (isPro) {
      const token = await user.getIdToken()
      return { isManaged: true, token }
    }
    return { isManaged: false, token: null }
  } catch (e) {
    console.warn("Fikr Cloud managed auth check failed:", e)
    return { isManaged: false, token: null }
  }
}

// ── useAISettings hook ────────────────────────────────────────────────────────

export function useAISettings() {
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setSettings(loadSettings())
    setIsHydrated(true)
  }, [])

  const updateSettings = useCallback((patch: Partial<AISettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  // Backwards-compat: resolvedModelId → analysis model for the status bar
  const resolvedModelId = (() => {
    const cfg = loadAIConfig()
    if (!cfg) return ""
    return resolveModel(cfg, "analysis")
  })()

  // Backwards-compat: currentModel shape used by page.tsx for display
  const currentModel = {
    id:              resolvedModelId,
    label:           resolvedModelId.split("/").pop() ?? resolvedModelId,
    shortLabel:      resolvedModelId.split("/").pop() ?? resolvedModelId,
    description:     `${TASK_PRESET_NAMES.analysis} · ${getPreset(settings.provider).label}`,
    supportsGrounding: settings.provider === "openrouter" || settings.provider === "openai",
  }

  // Kept for any code that still reads settings.modelId
  const models = getModelsForProvider(settings.provider)

  return { settings, updateSettings, isHydrated, resolvedModelId, currentModel, models }
}
