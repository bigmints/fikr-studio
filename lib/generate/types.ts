// ── Studio Project (persisted to workspace.json) ──────────────────────────────

export type ContentMode = "article" | "podcast" | "video-script";
export type Platform    = "linkedin" | "substack";

// ── Article version snapshot ───────────────────────────────────────────────────

export interface ArticleVersion {
  id:        string;
  label:     string;    // e.g. "Generated", "Before AI edit", "Manual save"
  savedAt:   number;    // Unix ms
  markdown:  string;    // Full article markdown at time of save
  wordCount: number;
  isManual:  boolean;   // true = explicit user action; false = auto
}

// Max versions to keep per project (Electron is generous; browser is conservative)
export const MAX_ARTICLE_VERSIONS = 30;

export interface StudioProject {
  id:          string;
  name:        string;
  mode:        ContentMode;
  platform:    Platform;
  createdAt:   number;
  updatedAt:   number;
  status:      "ideating" | "generating" | "done" | "published" | "error";
  // Ideation inputs
  selectedTopicTitle?: string;
  customPrompt?:       string;
  tone:     number;   // 0–100
  depth:    number;   // 0–100
  audience: number;   // 0–100
  // Persisted generation params (so generate view can resume after navigation)
  lastParams?: GenerateParams;
  // Generated output
  outputMarkdown?: string;
  citations?:      Citation[];
  error?:          string;
  archived?:       boolean;
  // The exact system prompt used for the last generation run
  systemPrompt?:   string;
  // Version history — capped at MAX_ARTICLE_VERSIONS
  versions?: ArticleVersion[];
}



// ── Engine types ───────────────────────────────────────────────────────────────

export interface ScoredTopic {
  title:       string;
  score:       number;     // 0–100
  noteIds:     string[];
  previewText: string;
}

export interface Citation {
  index:       number;
  noteId:      string;
  notePreview: string;
}

export type HeatColor = "hot" | "cold" | "neutral";

export interface HeatAnnotation {
  text:        string;
  color:       HeatColor;
  startOffset: number;
  endOffset:   number;
}

export interface GenerateParams {
  mode:         ContentMode;
  platform:     Platform;
  presetId?:    string;
  maxLength?:   number;
  enableHashtags?: boolean;
  tone:         number;
  depth:        number;
  audience:     number;
  topicTitle:   string;
  customPrompt: string;
  noteContext:  string;
}

// ── Mode registry ──────────────────────────────────────────────────────────────

export interface GenerationMode {
  id:              ContentMode;
  label:           string;
  icon:            string;
  platforms:       Platform[];
  systemPromptTpl: string;
  maxOutputTokens: number;
  comingSoon?:     boolean;
}
