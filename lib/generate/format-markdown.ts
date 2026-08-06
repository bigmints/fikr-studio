import {
  getManagedAuthStatus,
  loadAIConfig,
  resolveModel,
  type AIProvider,
} from "@/lib/ai-settings";
import { requestByokAi } from "@/lib/ai-provider-request";
import { LOCAL_AI_CONFIG } from "@/local-ai.config";

export type MarkdownFormatMode = "cleanup" | "structure";

const TIMEOUT_MS = 90_000;
const MAX_OUTPUT_TOKENS = 4_000;

const MODE_INSTRUCTIONS: Record<MarkdownFormatMode, string> = {
  cleanup:
    "Repair Markdown syntax, spacing, heading consistency, lists, tables, code fences, and links. Preserve every word exactly.",
  structure:
    "Organize the existing content into a clear Markdown document with useful headings, sections, lists, and emphasis. Keep every sentence verbatim. You may move existing blocks and add concise structural headings, but must not rewrite the content.",
};

export function cleanFormattedMarkdown(value: string): string {
  return value
    .trim()
    .replace(/^```(?:markdown|md)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

export function markdownFormatSystemPrompt(mode: MarkdownFormatMode, scope: "selection" | "document"): string {
  return `You are a precise Markdown editor. ${MODE_INSTRUCTIONS[mode]}

Rules:
- Return only valid Markdown. Never add a preamble, explanation, or enclosing code fence.
- Never paraphrase or rewrite the supplied sentences.
- Preserve YAML frontmatter when present.
- Preserve code content exactly; only repair the surrounding fence when needed.
- Preserve URLs, citations, task completion states, and table data.
- ${scope === "selection" ? "Format only the supplied selection so it can be inserted back into the surrounding document." : "Return the complete formatted document."}`;
}

export async function formatMarkdownWithAi(
  markdown: string,
  mode: MarkdownFormatMode,
  scope: "selection" | "document",
  signal?: AbortSignal,
): Promise<string> {
  if (!markdown.trim()) throw new Error("There is no Markdown to format.");

  const systemPrompt = markdownFormatSystemPrompt(mode, scope);
  const { isManaged, token } = await getManagedAuthStatus();
  const isDevOverride = LOCAL_AI_CONFIG.enabled;
  let actualModel = LOCAL_AI_CONFIG.model;
  let byokProvider: AIProvider | null = null;

  if (typeof window !== "undefined") {
    actualModel = localStorage.getItem("dev_local_model") || actualModel;
  }

  if (!isDevOverride && !isManaged) {
    const config = loadAIConfig();
    if (!config?.apiKey) {
      throw new Error("Add an AI key in Settings → AI Models, or use a managed Fikr plan.");
    }
    const resolved = resolveModel(config, "analysis");
    if (!resolved) throw new Error("No analysis model is configured.");
    actualModel = resolved;
    byokProvider = config.provider;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener("abort", () => controller.abort(), { once: true });

  try {
    if (isManaged && !isDevOverride) {
      const response = await fetch("https://fikr.one/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ systemPrompt, userMessage: markdown }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Fikr Cloud could not format this document (${response.status}).`);
      const data = await response.json() as { response?: string };
      const formatted = cleanFormattedMarkdown(data.response || "");
      if (!formatted) throw new Error("The model returned an empty document.");
      return formatted;
    }

    const body = {
      model: actualModel,
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: mode === "cleanup" ? 0 : 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: markdown },
      ],
    };
    const response = isDevOverride
      ? await fetch(`${LOCAL_AI_CONFIG.baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
      : await requestByokAi(byokProvider!, body);

    if (!response.ok) throw new Error(`The AI provider could not format this document (${response.status}).`);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const formatted = cleanFormattedMarkdown(data.choices?.[0]?.message?.content || "");
    if (!formatted) throw new Error("The model returned an empty document.");
    return formatted;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("AI formatting timed out or was cancelled.", { cause: error });
    }
    if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
      throw new Error(
        "Couldn’t reach the configured AI model. Check Settings → AI Models and try again.",
        { cause: error },
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
