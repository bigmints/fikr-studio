const MAX_QUERY_LENGTH = 4_000;
const MAX_RESULTS = 20;
const MAX_THREADS = 50;
const MAX_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 50_000;
const MAX_CHAT_TITLE_WORDS = 5;
const KNOWLEDGE_NOTE_ACKNOWLEDGEMENT = "I drafted the note. Review it below, then save when ready.";
const SEARCH_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "can", "could",
  "did", "do", "does", "for", "from", "had", "has", "have", "how", "i", "in", "is",
  "it", "me", "much", "my", "of", "on", "or", "our", "please", "that", "the", "their",
  "there", "this", "to", "was", "were", "what", "when", "where", "which", "who", "why",
  "will", "with", "would", "you", "your",
]);
const TEMPORAL_SEARCH_TERMS = new Set(["current", "day", "last", "latest", "month", "recent", "today", "week", "year", "yesterday"]);

export function selectChatExecutionRoute({ managedAvailable, localOverride, configuredProviderKey }) {
  if (localOverride) return "local-agent";
  if (configuredProviderKey) return "byok-agent";
  if (managedAvailable) return "managed";
  return "unavailable";
}

export function canCreateSocialArtifact(queryValue) {
  const query = normalizedText(queryValue);
  const creationVerb = /\b(create|write|draft|generate|make|produce|compose|repurpose|turn|convert)\b/;
  const socialTarget = /\b(linkedin|twitter|tweet|social post|social media post|instagram|facebook|caption|x post|post for x|thread for x)\b/;
  return creationVerb.test(query) && socialTarget.test(query);
}

/**
 * Some workspace-wide actions are intentionally broader than a keyword query.
 * When their wording does not overlap any note, the chat should still receive
 * a small, scoped sample instead of incorrectly claiming the workspace is
 * empty. Ordinary conversation (for example, "hello") must not pull notes in.
 */
export function shouldUseWorkspaceFallback(queryValue) {
  const query = normalizedText(queryValue);
  if (!query) return false;
  const asksForSynthesis = /\b(insight|insights|pattern|patterns|synthesize|synthesis|themes|connections|relationships)\b/.test(query);
  const asksForKnowledgeOverview = /\b(how many|count|overview|summarize|summary|what do i have)\b/.test(query)
    && /\b(notes|knowledge|workspace)\b/.test(query);
  const asksToCreateFromKnowledge = canCreateSocialArtifact(query)
    && /\b(notes|knowledge|workspace)\b/.test(query);
  return asksForSynthesis || asksForKnowledgeOverview || asksToCreateFromKnowledge;
}

export function titleFromQuery(queryValue) {
  let title = String(queryValue ?? "")
    .normalize("NFKC")
    .replace(/[`*_#]+/g, " ")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[?.!,;:]+$/, "");

  if (!title) return "New conversation";

  title = title
    .replace(/^(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+)?(?:help\s+me\s+)?(?:create|write|draft|generate|make|compose|produce|find|show|tell|explain|summarize|analyse|analyze)\s+/i, "")
    .replace(/^(?:me\s+)?(?:a|an|the)\s+/i, "")
    .replace(/\s+(?:from|using|based\s+on)\s+(?:all\s+)?(?:of\s+)?(?:my\s+)?(?:notes|knowledge)\b.*$/i, "")
    .trim();

  const socialPost = title.match(/^(linkedin|twitter|x|instagram|facebook|threads)\s+(?:social\s+)?post\s+(?:about|on)\s+(.+)$/i);
  if (socialPost) {
    const platform = socialPost[1].toLowerCase() === "linkedin" ? "LinkedIn" : socialPost[1];
    title = `${platform} post: ${socialPost[2]}`;
  } else {
    title = title.replace(/^(?:about|on)\s+/i, "");
  }

  const compact = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_CHAT_TITLE_WORDS)
    .join(" ")
    .replace(/[?.!,;:]+$/, "")
    .trim();

  if (!compact) return "New conversation";
  return compact.charAt(0).toUpperCase() + compact.slice(1);
}

function normalizedText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function tokens(value) {
  return normalizedText(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !SEARCH_STOP_WORDS.has(token));
}

function boundedInteger(value, fallback, min, max) {
  if (!Number.isFinite(Number(value))) return fallback;
  return Math.min(max, Math.max(min, Math.floor(Number(value))));
}

function finiteTimestamp(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function cleanId(value) {
  return String(value ?? "").trim().slice(0, 240);
}

function slug(value) {
  const result = normalizedText(value)
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return result || "conversation";
}

function uniqueId(base, existingIds) {
  const used = new Set(Array.from(existingIds ?? [], (id) => String(id)));
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function scoreNote(query, queryTokens, tokenWeights, note) {
  const title = normalizedText(note.title);
  const text = normalizedText(note.text);
  const annotation = normalizedText(note.annotation);
  const category = normalizedText(note.category);
  const type = normalizedText(note.contentType);
  const haystack = [title, text, annotation, category, type].filter(Boolean).join(" ");

  let score = 0;
  if (query && haystack.includes(query)) score += 8;
  for (const token of queryTokens) {
    const weight = tokenWeights.get(token) ?? 1;
    if (title.includes(token)) score += 3 * weight;
    if (category.includes(token)) score += 2 * weight;
    if (text.includes(token)) score += 2 * weight;
    if (annotation.includes(token)) score += 1.5 * weight;
    if (type.includes(token)) score += 0.5 * weight;
  }

  const timestamp = finiteTimestamp(note.timestamp, 0);
  if (score > 0 && timestamp > 0) score += Math.min(timestamp / 1e13, 0.05);
  // Derived chat insights rank below the original notes they summarize so
  // conversations do not create a self-reinforcing loop. Explicitly saved
  // knowledge notes remain first-class searchable knowledge.
  if (note.fromChat && normalizedText(note.category).includes("insight")) score *= 0.35;
  return score;
}

/**
 * Deterministic cross-workspace lexical retrieval. The renderer may merge these
 * results with its in-memory relevance vectors, but this function stays model-
 * free so it remains testable and available offline.
 */
export function retrieveKnowledge(queryValue, projectsValue, options = {}) {
  const query = normalizedText(String(queryValue ?? "").slice(0, MAX_QUERY_LENGTH));
  const queryTokens = tokens(query);
  if (!query || queryTokens.length === 0 || !Array.isArray(projectsValue)) return [];

  const limit = boundedInteger(options.limit, 8, 1, MAX_RESULTS);
  const allowedProjects = Array.isArray(options.projectIds) && options.projectIds.length > 0
    ? new Set(options.projectIds.map(String))
    : null;

  const candidates = [];
  for (const project of projectsValue) {
    const projectId = cleanId(project?.id);
    if (!projectId || (allowedProjects && !allowedProjects.has(projectId))) continue;
    const projectName = String(project?.name ?? "Untitled workspace").trim().slice(0, 240);
    for (const note of Array.isArray(project?.blocks) ? project.blocks : []) {
      const noteId = cleanId(note?.id);
      const text = String(note?.text ?? "").trim();
      if (!noteId || !text) continue;
      candidates.push({ projectId, projectName, note, noteId, text });
    }
  }

  const tokenFrequencies = new Map();
  const tokenWeights = new Map(queryTokens.map((token) => {
    const documentFrequency = candidates.reduce((count, candidate) => {
      const searchable = normalizedText([
        candidate.note.title,
        candidate.text,
        candidate.note.annotation,
        candidate.note.category,
        candidate.note.contentType,
      ].filter(Boolean).join(" "));
      return count + Number(searchable.includes(token));
    }, 0);
    tokenFrequencies.set(token, documentFrequency);
    const specificity = 1 + Math.log((candidates.length + 1) / (documentFrequency + 1));
    return [token, specificity * (TEMPORAL_SEARCH_TERMS.has(token) ? 0.25 : 1)];
  }));
  const substantiveTokens = queryTokens
    .filter((token) => !TEMPORAL_SEARCH_TERMS.has(token) && (tokenFrequencies.get(token) ?? 0) > 0)
    .sort((left, right) => (tokenWeights.get(right) ?? 0) - (tokenWeights.get(left) ?? 0));
  const strongestToken = substantiveTokens[0];
  const strongestWeight = tokenWeights.get(strongestToken) ?? 0;
  const nextWeight = tokenWeights.get(substantiveTokens[1]) ?? 0;
  const anchorToken = strongestToken && (substantiveTokens.length === 1 || strongestWeight >= nextWeight * 1.35)
    ? strongestToken
    : null;

  const scored = [];
  for (const { projectId, projectName, note, noteId, text } of candidates) {
    const searchable = normalizedText([
      note.title,
      text,
      note.annotation,
      note.category,
      note.contentType,
    ].filter(Boolean).join(" "));
    if (anchorToken && !searchable.includes(anchorToken)) continue;
    const score = scoreNote(query, queryTokens, tokenWeights, note);
    if (score <= 0) continue;
    scored.push({
      noteId,
      projectId,
      projectName,
      title: String(note?.title ?? "").trim().slice(0, 240),
      text: text.slice(0, 12_000),
      annotation: String(note?.annotation ?? "").trim().slice(0, 4_000),
      contentType: String(note?.contentType ?? "general").trim().slice(0, 80),
      category: String(note?.category ?? "").trim().slice(0, 160),
      timestamp: finiteTimestamp(note?.timestamp, 0),
      score,
    });
  }

  if (scored.length === 0 && options.fallbackToRecent === true) {
    return candidates
      .sort((left, right) => {
        const timeDifference = finiteTimestamp(right.note?.timestamp, 0) - finiteTimestamp(left.note?.timestamp, 0);
        return timeDifference || left.noteId.localeCompare(right.noteId);
      })
      .slice(0, limit)
      .map(({ projectId, projectName, note, noteId, text }, index) => ({
        noteId,
        projectId,
        projectName,
        title: String(note?.title ?? "").trim().slice(0, 240),
        text: text.slice(0, 12_000),
        annotation: String(note?.annotation ?? "").trim().slice(0, 4_000),
        contentType: String(note?.contentType ?? "general").trim().slice(0, 80),
        category: String(note?.category ?? "").trim().slice(0, 160),
        timestamp: finiteTimestamp(note?.timestamp, 0),
        score: 0.01,
        citationIndex: index + 1,
      }));
  }

  return scored
    .sort((left, right) => right.score - left.score || right.timestamp - left.timestamp || left.noteId.localeCompare(right.noteId))
    .slice(0, limit)
    .map((result, index) => ({ ...result, citationIndex: index + 1 }));
}

export function mergeKnowledgeSources(lexicalValue, semanticValue, options = {}) {
  const lexical = Array.isArray(lexicalValue) ? lexicalValue.filter((source) => cleanId(source?.noteId)) : [];
  const semantic = Array.isArray(semanticValue) ? semanticValue.filter((source) => cleanId(source?.noteId)) : [];
  const limit = boundedInteger(options.limit, 8, 1, MAX_RESULTS);
  const lexicalMax = Math.max(0, ...lexical.map((source) => Number(source.score) || 0));
  const merged = new Map();

  lexical.forEach((source, rank) => {
    const normalizedScore = lexicalMax > 0 ? Math.max(0, Number(source.score) || 0) / lexicalMax : 0;
    merged.set(source.noteId, {
      source,
      score: normalizedScore * 0.7,
      lexicalRank: rank,
      semanticRank: Number.POSITIVE_INFINITY,
    });
  });

  semantic.forEach((source, rank) => {
    const semanticScore = Math.min(1, Math.max(0, Number(source.score) || 0));
    const existing = merged.get(source.noteId);
    if (existing) {
      existing.score += semanticScore * 0.3;
      existing.semanticRank = rank;
      return;
    }
    merged.set(source.noteId, {
      source,
      score: semanticScore * 0.3,
      lexicalRank: Number.POSITIVE_INFINITY,
      semanticRank: rank,
    });
  });

  const ranked = Array.from(merged.values())
    .sort((left, right) =>
      right.score - left.score
      || left.lexicalRank - right.lexicalRank
      || left.semanticRank - right.semanticRank
      || (right.source.timestamp ?? 0) - (left.source.timestamp ?? 0));
  const relevanceFloor = lexical.length > 0 && ranked.length > 0 ? ranked[0].score * 0.45 : 0;

  return ranked
    .filter((candidate) => candidate.score >= relevanceFloor)
    .slice(0, limit)
    .map(({ source, score }, index) => ({ ...source, score, citationIndex: index + 1 }));
}

/**
 * Suggests an existing project for a reviewable knowledge draft without
 * persisting anything. Explicit chat scope and cited notes are stronger
 * signals than lexical similarity, and ambiguous matches return null.
 */
export function recommendProjectForKnowledgeDraft(draftValue, projectsValue, context = {}) {
  const projects = Array.isArray(projectsValue)
    ? projectsValue.filter((project) => cleanId(project?.id))
    : [];
  if (projects.length === 0) return null;

  const projectIds = new Set(projects.map((project) => cleanId(project.id)));
  const scopedIds = context?.scope?.kind === "projects" && Array.isArray(context.scope.projectIds)
    ? context.scope.projectIds.map(cleanId).filter((id) => projectIds.has(id))
    : [];
  if (scopedIds.length === 1) return scopedIds[0];

  const sourceIds = new Set(Array.isArray(context?.sourceNoteIds)
    ? context.sourceNoteIds.map(cleanId).filter(Boolean)
    : []);
  if (sourceIds.size > 0) {
    const sourceCounts = new Map();
    for (const project of projects) {
      const count = (Array.isArray(project.blocks) ? project.blocks : [])
        .filter((note) => sourceIds.has(cleanId(note?.id))).length;
      if (count > 0) sourceCounts.set(cleanId(project.id), count);
    }
    const rankedSources = Array.from(sourceCounts, ([projectId, count]) => ({ projectId, count }))
      .sort((left, right) => right.count - left.count || left.projectId.localeCompare(right.projectId));
    if (rankedSources[0] && (!rankedSources[1] || rankedSources[0].count > rankedSources[1].count)) {
      return rankedSources[0].projectId;
    }
  }

  const query = `${String(draftValue?.title ?? "")} ${String(draftValue?.content ?? "")}`
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
  const queryTokens = new Set(tokens(query));
  if (queryTokens.size === 0) return null;

  const scores = new Map(projects.map((project) => {
    const projectId = cleanId(project.id);
    const projectName = normalizedText(project.name);
    let nameScore = 0;
    for (const token of queryTokens) {
      if (projectName.includes(token)) nameScore += 4;
    }
    return [projectId, nameScore];
  }));

  for (const match of retrieveKnowledge(query, projects, { limit: MAX_RESULTS })) {
    scores.set(match.projectId, Math.max(scores.get(match.projectId) ?? 0, match.score));
  }

  const ranked = Array.from(scores, ([projectId, score]) => ({ projectId, score }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.projectId.localeCompare(right.projectId));
  if (!ranked[0]) return null;
  if (ranked[1] && ranked[0].score < ranked[1].score * 1.2) return null;
  return ranked[0].projectId;
}

export function shouldOfferInsightSave(message) {
  if (!message || message.role !== "assistant" || message.outputKind !== "insight") return false;
  return Boolean(normalizeInsightDraft(message.insightDraft));
}

function sourceLabel(source) {
  return source.title || source.category || source.projectName || "Knowledge note";
}

function sentenceFromSource(source) {
  const raw = source.annotation || source.text;
  const first = String(raw)
    .split(/\n+|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^\s*(?:#{1,6}|[-*+]\s*(?:\[[ xX]\])?|\d+[.)])\s*/, "").trim())
    .find(Boolean);
  return (first || "Use the clearest supported point from this note.").slice(0, 140);
}

/** Deterministic no-spend response used only by the explicit UI-test build. */
export function buildCitedAnswerFixture(queryValue, sourcesValue) {
  const query = String(queryValue ?? "").trim();
  const sources = Array.isArray(sourcesValue) ? sourcesValue.slice(0, 5) : [];
  const citations = sources.map((source) => source.noteId);

  const answer = sources.length === 0
    ? "I couldn’t find enough information in your knowledge to answer that yet. Add a note or choose another workspace, then try again."
    : `I found ${sources.length} relevant ${sources.length === 1 ? "note" : "notes"} in your knowledge. ${sources
        .slice(0, 3)
        .map((source) => `${sentenceFromSource(source)} [${source.citationIndex}]`)
        .join(" ")}`;

  const wantsArtifact = /\b(linkedin|social|post|thread|article|newsletter|caption)\b/i.test(query);
  let artifact;
  if (wantsArtifact && sources.length > 0) {
    const lead = sentenceFromSource(sources[0]).replace(/[.!?]+$/, "");
    const support = sources[1] ? sentenceFromSource(sources[1]).replace(/[.!?]+$/, "") : "Make the value concrete and easy to understand";
    artifact = {
      kind: "social-post",
      platform: /\b(x|twitter|thread)\b/i.test(query) ? "x" : "linkedin",
      title: "Knowledge into action",
      content: `${lead}.\n\n${support}.\n\nThe strongest launches turn real customer knowledge into a clear next step.\n\n#ProductLaunch #CustomerKnowledge #BuildInPublic`,
      sourceNoteIds: citations,
    };
  }

  return { answer, citations, artifact, outputKind: artifact ? "creation" : "answer" };
}

function normalizeArtifact(value) {
  if (!value || typeof value !== "object") return undefined;
  const content = String(value.content ?? "").trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!content) return undefined;
  const platform = value.platform === "x" ? "x" : "linkedin";
  return {
    kind: "social-post",
    platform,
    title: String(value.title ?? "Social post").trim().slice(0, 240) || "Social post",
    content,
    sourceNoteIds: Array.isArray(value.sourceNoteIds)
      ? value.sourceNoteIds.map(cleanId).filter(Boolean).slice(0, 20)
      : [],
  };
}

function normalizeInsightDraft(value) {
  if (!value || typeof value !== "object") return undefined;
  const title = String(value.title ?? "").trim().slice(0, 240);
  const content = String(value.content ?? "").trim().slice(0, MAX_MESSAGE_LENGTH);
  const sourceNoteIds = Array.isArray(value.sourceNoteIds)
    ? Array.from(new Set(value.sourceNoteIds.map(cleanId).filter(Boolean))).slice(0, 20)
    : [];
  if (!title || !content || sourceNoteIds.length === 0) return undefined;
  return { title, content, sourceNoteIds };
}

function normalizeNoteDraft(value) {
  if (!value || typeof value !== "object") return undefined;
  const title = String(value.title ?? "").trim().slice(0, 240);
  const content = String(value.content ?? "").trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!title || !content) return undefined;
  return { title, content };
}

function normalizeOutputKind(value, artifact, insightDraft, noteDraft) {
  if (artifact) return "creation";
  if (value === "insight" && insightDraft) return "insight";
  if (value === "knowledge-note" && noteDraft) return "knowledge-note";
  return "answer";
}

function normalizeAgentEvent(value) {
  if (!value || typeof value !== "object") return null;
  const allowedTypes = new Set([
    "run_started",
    "mcp_connecting",
    "mcp_connected",
    "tool_started",
    "tool_completed",
    "run_completed",
    "run_canceled",
    "run_failed",
  ]);
  const type = String(value.type ?? "");
  const runId = cleanId(value.runId);
  const message = String(value.message ?? "").trim().slice(0, 1_000);
  if (!runId || !allowedTypes.has(type) || !message) return null;
  const toolName = cleanId(value.toolName);
  return {
    runId,
    type,
    at: finiteTimestamp(value.at, Date.now()),
    message,
    ...(toolName ? { toolName } : {}),
  };
}

export function dedupeAgentEvents(value) {
  if (!Array.isArray(value)) return [];
  const events = value.map(normalizeAgentEvent).filter(Boolean).slice(-30);
  const unique = [];
  const indexByIdentity = new Map();
  for (const event of events) {
    const identity = event.toolName
      ? `${event.type}:${event.toolName}`
      : `${event.type}:${normalizedText(event.message)}`;
    const existingIndex = indexByIdentity.get(identity);
    if (existingIndex === undefined) {
      indexByIdentity.set(identity, unique.length);
      unique.push(event);
    } else {
      unique[existingIndex] = event;
    }
  }
  return unique;
}

function normalizeAttachmentMetadata(value) {
  if (!value || typeof value !== "object") return null;
  const id = cleanId(value.id);
  const name = (String(value.name ?? "").trim().split(/[\\/]/).pop() ?? "").slice(0, 180);
  const mediaType = String(value.mediaType ?? "").trim().toLowerCase();
  const kind = mediaType === "application/pdf"
    ? "pdf"
    : ["image/jpeg", "image/png", "image/webp"].includes(mediaType)
      ? "image"
      : null;
  const size = boundedInteger(value.size, 0, 0, 10 * 1024 * 1024);
  if (!id || !name || !kind || value.kind !== kind || size <= 0) return null;
  return { id, name, kind, mediaType, size };
}

function normalizeMessage(value) {
  if (!value || typeof value !== "object") return null;
  const id = cleanId(value.id);
  const role = value.role === "user" || value.role === "assistant" ? value.role : null;
  const content = String(value.content ?? "").trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!id || !role || !content) return null;
  const artifact = normalizeArtifact(value.artifact);
  const insightDraft = normalizeInsightDraft(value.insightDraft);
  const noteDraft = normalizeNoteDraft(value.noteDraft);
  const outputKind = role === "assistant"
    ? normalizeOutputKind(value.outputKind, artifact, insightDraft, noteDraft)
    : "answer";
  return {
    id,
    role,
    content: outputKind === "knowledge-note" ? KNOWLEDGE_NOTE_ACKNOWLEDGEMENT : content,
    createdAt: finiteTimestamp(value.createdAt, Date.now()),
    sourceNoteIds: Array.isArray(value.sourceNoteIds)
      ? value.sourceNoteIds.map(cleanId).filter(Boolean).slice(0, 20)
      : [],
    outputKind,
    attachments: role === "user" && Array.isArray(value.attachments)
      ? value.attachments.map(normalizeAttachmentMetadata).filter(Boolean).slice(0, 4)
      : undefined,
    artifact,
    insightDraft,
    noteDraft,
    agentEvents: Array.isArray(value.agentEvents) ? dedupeAgentEvents(value.agentEvents) : undefined,
    status: role === "user" && value.status === "stopped" ? "stopped" : undefined,
  };
}

export function normalizeChatThreads(value) {
  if (!Array.isArray(value)) return [];
  const normalized = [];
  for (const candidate of value.slice(0, MAX_THREADS)) {
    if (!candidate || typeof candidate !== "object") continue;
    const id = cleanId(candidate.id);
    if (!id) continue;
    const messages = (Array.isArray(candidate.messages) ? candidate.messages : [])
      .slice(-MAX_MESSAGES)
      .map(normalizeMessage)
      .filter(Boolean);
    const projectIds = Array.isArray(candidate.scope?.projectIds)
      ? candidate.scope.projectIds.map(cleanId).filter(Boolean).slice(0, 20)
      : [];
    const storedTitle = String(candidate.title ?? "").trim();
    const firstUserMessage = messages.find((message) => message.role === "user")?.content;
    const titleSource = !storedTitle || storedTitle === "New conversation"
      ? firstUserMessage
      : storedTitle;
    normalized.push({
      id,
      title: titleFromQuery(titleSource),
      createdAt: finiteTimestamp(candidate.createdAt, Date.now()),
      updatedAt: finiteTimestamp(candidate.updatedAt, Date.now()),
      scope: projectIds.length > 0 ? { kind: "projects", projectIds } : { kind: "all" },
      messages,
    });
  }
  return normalized.sort((left, right) => right.updatedAt - left.updatedAt);
}

export function createKnowledgeNoteFromAnswer({
  answer,
  title,
  kind = "insight",
  threadId,
  existingIds = /** @type {string[]} */ ([]),
  now = Date.now(),
}) {
  const safeNow = finiteTimestamp(now, Date.now());
  const safeThreadId = slug(threadId);
  const id = uniqueId(`chat-${safeThreadId}-${safeNow}`, existingIds);
  return {
    id,
    title: String(title ?? "").trim().slice(0, 240) || undefined,
    text: String(answer ?? "").trim().slice(0, MAX_MESSAGE_LENGTH),
    timestamp: safeNow,
    contentType: kind === "knowledge-note" ? "general" : "reflection",
    category: kind === "knowledge-note" ? "Fikr Chat · Knowledge note" : "Fikr Chat · Insight",
    annotation: kind === "knowledge-note"
      ? "Drafted in Fikr Chat and saved after explicit confirmation."
      : "Derived from Fikr knowledge and saved after explicit confirmation.",
    confidence: null,
    isEnriching: false,
    isError: false,
    fromChat: true,
    sourceThreadId: cleanId(threadId),
  };
}

export function createCreationFromArtifact({
  artifact: artifactValue,
  threadId,
  existingIds = /** @type {string[]} */ ([]),
  now = Date.now(),
}) {
  const artifact = normalizeArtifact(artifactValue);
  if (!artifact) throw new Error("A valid social-post artifact is required");
  const safeNow = finiteTimestamp(now, Date.now());
  const safeThreadId = slug(threadId);
  const id = uniqueId(`creation-${safeThreadId}-${safeNow}`, existingIds);
  return {
    id,
    name: artifact.title,
    mode: "article",
    platform: artifact.platform,
    createdAt: safeNow,
    updatedAt: safeNow,
    status: "done",
    tone: 50,
    depth: 50,
    audience: 50,
    outputMarkdown: artifact.content,
    citations: artifact.sourceNoteIds.map((noteId, index) => ({
      index: index + 1,
      noteId,
      notePreview: "Saved from cited Fikr knowledge",
    })),
    sourceThreadId: cleanId(threadId),
    creationKind: "social-post",
  };
}

export function creationMatchesArtifact(creationValue, artifactValue) {
  const artifact = normalizeArtifact(artifactValue);
  if (!artifact || !creationValue || typeof creationValue !== "object") return false;
  const content = String(creationValue.outputMarkdown ?? "").trim();
  const platform = creationValue.platform === "x" ? "x" : "linkedin";
  return content === artifact.content.trim() && platform === artifact.platform;
}
