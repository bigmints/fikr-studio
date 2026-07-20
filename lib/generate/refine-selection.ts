/**
 * Refines a single snippet of text using the AI.
 * Takes the selected text and an action (expand | trim | rephrase),
 * returns the AI-edited replacement text.
 */

import {
  loadAIConfig,
  resolveModel,
  getManagedAuthStatus,
} from "@/lib/ai-settings";
import { LOCAL_AI_CONFIG } from "@/local-ai.config";
import { requestByokAi } from "@/lib/ai-provider-request";

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

  const { isManaged, token } = await getManagedAuthStatus();
  const isDevOverride = LOCAL_AI_CONFIG.enabled;

  const actualBaseUrl = LOCAL_AI_CONFIG.baseUrl;
  let actualModel = LOCAL_AI_CONFIG.model;
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("dev_local_model");
    if (stored) actualModel = stored;
  }
  let byokProvider: import("@/lib/ai-settings").AIProvider | null = null;

  if (!isDevOverride && !isManaged) {
    const config = loadAIConfig();
    if (!config || !config.apiKey) throw new Error("No API key configured and Fikr Cloud Pro is inactive.");
    const resolved = resolveModel(config, "analysis");
    if (!resolved) throw new Error("No model configured.");
    actualModel = resolved;
    byokProvider = config.provider;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener("abort", () => controller.abort(), { once: true });

  try {
    if (isManaged && !isDevOverride) {
      const res = await fetch("https://fikr.one/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          systemPrompt,
          userMessage: text,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Fikr Cloud error ${res.status}: ${body}`);
      }

      const data = await res.json();
      const result = data.response?.trim() ?? "";
      if (!result) throw new Error("Empty response from model.");
      return result;
    }

    const providerBody = {
        model: actualModel,
        max_tokens: 1500,
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
    };
    const res = isDevOverride
      ? await fetch(`${actualBaseUrl}/chat/completions`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(providerBody), signal: controller.signal,
        })
      : await requestByokAi(byokProvider!, providerBody);

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
