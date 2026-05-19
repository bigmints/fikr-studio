/**
 * Refines a single snippet of text using the AI.
 * Takes the selected text and an action (expand | trim | rephrase),
 * returns the AI-edited replacement text.
 */

import {
  loadAIConfig,
  getBaseUrl,
  getProviderHeaders,
  resolveModel,
} from "@/lib/ai-settings";
import { LOCAL_AI_CONFIG } from "@/local-ai.config";

const TIMEOUT_MS = 60_000;

const ACTION_PROMPTS: Record<string, string> = {
  expand:
    "Expand the following text. Add more detail, examples, and depth while preserving the existing meaning and tone. Return ONLY the expanded text — no preamble, no explanation.",
  trim:
    "Trim the following text. Make it more concise without losing the key meaning. Return ONLY the trimmed text — no preamble, no explanation.",
  rephrase:
    "Rephrase the following text. Keep the same meaning but use different wording to make it clearer and more compelling. Return ONLY the rephrased text — no preamble, no explanation.",
};

export async function refineSelection(
  text: string,
  action: "expand" | "trim" | "rephrase",
  signal?: AbortSignal,
): Promise<string> {
  const systemPrompt = ACTION_PROMPTS[action];
  if (!systemPrompt) throw new Error(`Unknown action: ${action}`);

  // ── Use dev override if enabled ──────────────────────────────────────────
  const isDevOverride = LOCAL_AI_CONFIG.enabled;
  let actualBaseUrl = LOCAL_AI_CONFIG.baseUrl;
  let actualModel = LOCAL_AI_CONFIG.model;
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("dev_local_model");
    if (stored) actualModel = stored;
  }
  let actualHeaders: Record<string, string> = { "Content-Type": "application/json" };

  if (!isDevOverride) {
    const config = loadAIConfig();
    if (!config) throw new Error("No API key configured.");
    const resolved = resolveModel(config, "analysis");
    if (!resolved) throw new Error("No model configured.");
    actualBaseUrl = getBaseUrl(config);
    actualModel = resolved;
    actualHeaders = getProviderHeaders(config);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener("abort", () => controller.abort(), { once: true });

  try {
    const res = await fetch(`${actualBaseUrl}/chat/completions`, {
      method: "POST",
      headers: actualHeaders,
      body: JSON.stringify({
        model: actualModel,
        max_tokens: 1500,
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`API error ${res.status}: ${body}`);
    }

    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const result = data?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!result) throw new Error("Empty response from model.");
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}
