import type { GenerationMode } from "./types";

export const GENERATION_MODES: GenerationMode[] = [
  {
    id:              "article",
    label:           "Articles & Blogs",
    icon:            "FileText",
    platforms:       ["linkedin", "substack"],
    maxOutputTokens: 2000,
    systemPromptTpl: `You are an expert writer creating a {{platform}} post about "{{topic}}".
Tone: {{tone}}/100 (0=professional, 100=fun). Depth: {{depth}}/100 (0=brief, 100=detailed). Audience: {{audience}}/100 (0=expert, 100=beginner).
Content Rules: {{wordTarget}}
Use the following research notes as context. Cite them with [#N] markers.
<context>{{context}}</context>

OUTPUT RULES — CRITICAL:
- Begin your response IMMEDIATELY with the article content (start with a # heading).
- Do NOT include any preamble, meta-commentary, notes, explanations, or disclaimers before the article.
- Do NOT write sentences like "Note: Since no topic was specified…", "Here is a post on…", "I have written…", or anything similar.
- Do NOT wrap your output in markdown code fences.
- Output ONLY the article in Markdown.`,
  },
];

export function getModeById(id: string): GenerationMode | undefined {
  return GENERATION_MODES.find((m) => m.id === id);
}
