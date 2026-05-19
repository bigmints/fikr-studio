"use client";

import {
  loadAIConfig,
  getBaseUrl,
  getProviderHeaders,
  resolveModel,
  getManagedAuthStatus,
} from "@/lib/ai-settings";
import type { HeatAnnotation, GenerateParams } from "./types";

const HEAT_INSTRUCTIONS: Record<string, string> = {
  hot:     "Expand and amplify this section. Add more detail, energy, and supporting examples. Make it more prominent and compelling.",
  cold:    "Trim and condense this section drastically. Remove everything non-essential. Make it punchy and direct.",
  neutral: "Rephrase this section for clarity and better flow. Keep the exact meaning but improve the wording and readability.",
};

const TIMEOUT_MS = 60_000;

async function parseProviderError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.error?.message ?? body?.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status} ${res.statusText}`;
  }
}

/**
 * Surgical paragraph refinement using the heatmap color intent.
 * Returns the full article text with the selected segment replaced.
 */
export async function refineSegment(
  fullText: string,
  annotation: HeatAnnotation,
  _params: GenerateParams,
  onChunk: (updatedFull: string) => void,
  signal: AbortSignal,
): Promise<string> {
  const segment = annotation.text;
  const instruction = HEAT_INSTRUCTIONS[annotation.color] ?? HEAT_INSTRUCTIONS.neutral;

  // Provide 1 paragraph of context either side for the LLM
  const paragraphs = fullText.split(/\n\n+/);
  const segIdx = paragraphs.findIndex((p) => p.includes(segment.substring(0, 40)));
  const surroundStart = Math.max(0, segIdx - 1);
  const surroundEnd = Math.min(paragraphs.length - 1, segIdx + 1);
  const surroundingContext = paragraphs
    .slice(surroundStart, surroundEnd + 1)
    .filter((p) => !p.includes(segment.substring(0, 40)))
    .join("\n\n");

  const systemPrompt = `You are an expert editor performing a surgical rewrite.
TASK: ${instruction}
SURROUNDING CONTEXT (do NOT include this in your output):
${surroundingContext || "(none)"}
OUTPUT: Return ONLY the rewritten paragraph. No preamble, no quotes, no explanation.`;

  const userMessage = `PARAGRAPH TO REWRITE:\n${segment}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal.addEventListener("abort", () => controller.abort(), { once: true });

  let rewritten: string;

  try {
    const { isManaged, token } = await getManagedAuthStatus();

    if (isManaged && token) {
      const res = await fetch("https://fikr.one/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ systemPrompt, userMessage }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Fikr Cloud error (${res.status}): ${await parseProviderError(res)}`);
      const data = await res.json();
      rewritten = data.response ?? segment;
    } else {
      const config = loadAIConfig();
      if (!config) throw new Error("No API key configured.");
      const model = resolveModel(config, "analysis");
      if (!model) throw new Error(`No model for provider "${config.provider}".`);

      const res = await fetch(`${getBaseUrl(config)}/chat/completions`, {
        method: "POST",
        headers: getProviderHeaders(config),
        body: JSON.stringify({
          model,
          max_tokens: 800,
          temperature: 0.6,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user",   content: userMessage },
          ],
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`${config.provider} error: ${await parseProviderError(res)}`);

      const data = await res.json() as { choices?: { message?: { content?: string } }[] };
      rewritten = data.choices?.[0]?.message?.content ?? segment;
    }
  } finally {
    clearTimeout(timeoutId);
  }

  const updatedFull = fullText.replace(segment, rewritten || segment);
  onChunk(updatedFull);
  return updatedFull;
}
