"use client";

import {
  loadAIConfig,
  resolveModel,
  getManagedAuthStatus,
} from "@/lib/ai-settings";
import type { GenerateParams, Citation } from "./types";
import { getModeById } from "./generation-modes";
import { PLATFORM_CONFIGS } from "./platform-config";
import { LOCAL_AI_CONFIG } from "@/local-ai.config";
import PRESETS from "./presets.json";
import { requestByokAi } from "@/lib/ai-provider-request";

const MAX_OUTPUT_TOKENS = 2500;
const TIMEOUT_MS = 300_000; // Increased to 5 minutes for slow local models

function hydrate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (t, [k, v]) => t.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v),
    template,
  );
}

async function parseProviderError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.error?.message ?? body?.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status} ${res.statusText}`;
  }
}

/**
 * Generates content using the same proven pattern as ai-enrich.ts.
 * Uses non-streaming /chat/completions for reliability across all providers.
 * Managed (Pro) → fikr.one; BYOK → provider directly.
 *
 * onChunk is called once with the full response (future: real streaming).
 */
export async function streamGenerate(
  params: GenerateParams,
  onChunk: (delta: string) => void,
  signal: AbortSignal,
): Promise<{ citations: Citation[]; systemPrompt: string }> {
  const mode = getModeById(params.mode);
  if (!mode) throw new Error(`Unknown mode: ${params.mode}`);

  const preset = PRESETS.find(p => p.id === params.presetId) || PRESETS[0];

  const lengthRule = params.maxLength 
    ? `Strict limit: Maximum ${params.maxLength} words. Do not exceed this limit.`
    : `${PLATFORM_CONFIGS[params.platform]?.wordTarget?.[0] || 300}–${PLATFORM_CONFIGS[params.platform]?.wordTarget?.[1] || 800} words`;
    
  const hashtagsRule = params.enableHashtags 
    ? "Include relevant hashtags at the very end."
    : "DO NOT include any hashtags.";

  const wordTargetStr = `${lengthRule}\n${hashtagsRule}`;

  const systemPrompt = hydrate(mode.systemPromptTpl, {
    tone:       String(params.tone),
    depth:      String(params.depth),
    audience:   String(params.audience),
    topic:      params.topicTitle || params.customPrompt,
    context:    params.noteContext || "(no canvas notes — write from general knowledge)",
    platform:   preset.name || params.platform,
    wordTarget: wordTargetStr,
  });

  // User message is minimal — the system prompt carries the full brief
  const userMessage = params.customPrompt
    ? `Write about: ${params.topicTitle || params.customPrompt}\n\nExtra guidance: ${params.customPrompt}`
    : `Write about: ${params.topicTitle}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  // Merge external and internal abort signals
  signal.addEventListener("abort", () => controller.abort(), { once: true });

  // eslint-disable-next-line no-useless-assignment
  let rawContent: string = "";

  try {
    const { isManaged: _isManaged, token } = await getManagedAuthStatus();
    const isDevOverride = LOCAL_AI_CONFIG.enabled;

    if (_isManaged && !isDevOverride) {
      // ── Managed (Pro) path — fikr.one ─────────────────────────────────────
      const res = await fetch("https://fikr.one/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ systemPrompt, userMessage }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Fikr Cloud error (${res.status}): ${await parseProviderError(res)}`);
      }

      const data = await res.json();
      rawContent = data.response ?? "";

      // fikr.one wraps the response in a JSON envelope:
      // { "Topic Title": { Tone, Depth, Audience, Content: "<markdown>" } }
      // Extract the actual markdown from the Content field.
      if (rawContent.trim().startsWith("{")) {
        try {
          const envelope = JSON.parse(rawContent);
          const firstKey = Object.keys(envelope)[0];
          const inner = firstKey ? envelope[firstKey] : null;
          if (inner?.Content) {
            rawContent = inner.Content;
          } else if (inner?.content) {
            rawContent = inner.content;
          }
        } catch {
          // Not JSON — use rawContent as-is (plain markdown)
        }
      }


    } else {
      // ── BYOK path ─────────────────────────────────────────────────────────

      const actualBaseUrl = LOCAL_AI_CONFIG.baseUrl;
      let actualModel = LOCAL_AI_CONFIG.model;
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("dev_local_model");
        if (stored) actualModel = stored;
      }
      let providerName = "Local Model";

      if (!isDevOverride) {
        const config = loadAIConfig();
        if (!config || !config.apiKey) {
          throw new Error("No API key configured. Go to Settings → AI Models and add your key.");
        }
        const resolved = resolveModel(config, "analysis");
        if (!resolved) {
          throw new Error(`No model configured for provider "${config.provider}".`);
        }
        actualModel = resolved;
        providerName = config.provider;
      }

      // Gemini native REST uses a different path — route through OpenAI-compat endpoint
      // All three supported providers (OpenAI, OpenRouter, Gemini via OR) use /chat/completions
      const providerBody = {
          model: actualModel,
          max_tokens: MAX_OUTPUT_TOKENS,
          temperature: 0.7,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user",   content: userMessage },
          ],
      };
      const res = isDevOverride
        ? await fetch(`${actualBaseUrl}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(providerBody),
            signal: controller.signal,
          })
        : await requestByokAi(loadAIConfig()!.provider, providerBody);

      if (!res.ok) {
        throw new Error(
          `${providerName} API error: ${await parseProviderError(res)}`,
        );
      }

      let responseData: unknown;
      try {
        responseData = await res.json();
      } catch {
        throw new Error(
          `${providerName} returned invalid JSON. The model may have timed out.`,
        );
      }

      rawContent =
        (responseData as { choices?: { message?: { content?: string } }[] })
          ?.choices?.[0]?.message?.content ?? "";
    }
  } finally {
    clearTimeout(timeoutId);
  }

  if (!rawContent) {
    throw new Error("The model returned an empty response. Try again or adjust your parameters.");
  }

  // Strip markdown codeblock wrappers if the model hallucinated them
  rawContent = rawContent.replace(/^```(?:markdown|md)?\s*/i, "").replace(/```\s*$/i, "").trim();

  // Strip LLM meta-commentary preambles (defense-in-depth alongside UI cleanMarkdown)
  rawContent = rawContent
    .replace(/^\s*\([^)]*\)\s*\n*/m, "")
    .replace(/^\s*\{[^{]*?\}\s*\n*/m, "")
    .replace(/^\s*\*{0,2}Note\s*:\s*\*{0,2}[^\n]+\n*/i, "")
    .replace(/^\s*Note\s*:\s*[^\n]+\n*/i, "")
    .replace(/^\s*Since no topic was specified[^\n]+\n*/i, "")
    .replace(/^\s*I have written[^\n]+\n*/i, "")
    .replace(/^\s*Here(?:'s| is) (?:an?|the) [^\n]{0,80}\n*/i, "")
    .replace(/^\s*\*[^*\n]{10,200}\*\s*\n+/m, "")
    .trim();

  // Deliver the full content at once — onChunk is called progressively
  // to simulate streaming by delivering in ~200-char chunks
  const CHUNK_SIZE = 200;
  for (let i = 0; i < rawContent.length; i += CHUNK_SIZE) {
    onChunk(rawContent.slice(i, i + CHUNK_SIZE));
    // Tiny yield to let React re-render each chunk
    await new Promise((r) => setTimeout(r, 10));
  }

  return { citations: [], systemPrompt };
}
