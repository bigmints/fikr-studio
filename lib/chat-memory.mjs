const MAX_CHAT_MEMORIES = 200;
const MAX_MEMORY_TEXT_LENGTH = 500;
const MEMORY_KINDS = new Set(["preference", "identity", "project", "goal", "other"]);

function cleanId(value) {
  return String(value ?? "").trim().slice(0, 240);
}

function finiteTimestamp(value, fallback = Date.now()) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : fallback;
}

function normalizedText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function containsLikelySecret(value) {
  const text = String(value ?? "");
  return /\b(?:password|passcode|api[ _-]?key|access[ _-]?token|refresh[ _-]?token|secret)\s*(?:is|:|=)/i.test(text)
    || /\bsk-(?:proj-)?[A-Za-z0-9_-]{12,}\b/.test(text)
    || /\bgh[pousr]_[A-Za-z0-9]{20,}\b/.test(text);
}

export function classifyChatMemoryCommand(queryValue) {
  const query = normalizedText(queryValue);
  if (/\b(forget|remove|delete|clear)\b.*\b(memory|memories|remember|about me|preference)\b/.test(query)
    || /^forget\b/.test(query)) return "forget";
  if (/\b(what|show|list|tell)\b.*\b(remember|memories|about me)\b/.test(query)
    || /\bdo you remember\b/.test(query)) return "list";
  if (/\b(remember|keep in mind|save (?:this|that) as (?:a )?memory)\b/.test(query)) return "remember";
  return null;
}

function inferMemoryKind(text) {
  const normalized = normalizedText(text);
  if (/\b(prefer|preference|like|tone|format|style)\b/.test(normalized)) return "preference";
  if (/\b(my name|i am|i m|work as|my role)\b/.test(normalized)) return "identity";
  if (/\b(goal|aim|want to|plan to|working toward)\b/.test(normalized)) return "goal";
  if (/\b(project|product|building|launching)\b/.test(normalized)) return "project";
  return "other";
}

function rememberedText(queryValue) {
  const query = String(queryValue ?? "").trim();
  const patterns = [
    /^remember(?:\s+that)?\s+(.+)$/i,
    /^keep\s+in\s+mind(?:\s+that)?\s+(.+)$/i,
    /^save\s+(?:this|that)\s+as\s+(?:a\s+)?memory\s*[:,-]?\s*(.+)$/i,
  ];
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim().slice(0, MAX_MEMORY_TEXT_LENGTH);
  }
  return "";
}

export function executeChatMemoryCommand(queryValue, memoriesValue, { now = Date.now() } = {}) {
  const intent = classifyChatMemoryCommand(queryValue);
  if (!intent) return null;
  const memories = normalizeChatMemories(memoriesValue);
  if (intent === "list") {
    return {
      answer: memories.length > 0
        ? `Here’s what I remember:\n\n${memories.map((memory) => `- ${memory.text}`).join("\n")}`
        : "I don’t have any saved memories yet.",
      memoryMutations: [],
      toolName: "recall_fikr_memories",
      toolMessage: `Recalled ${memories.length} ${memories.length === 1 ? "memory" : "memories"}`,
    };
  }
  if (intent === "remember") {
    const text = rememberedText(queryValue);
    if (!text) return null;
    if (containsLikelySecret(text)) throw new Error("Secrets and credentials cannot be saved to memory");
    const duplicate = memories.find((memory) => normalizedText(memory.text) === normalizedText(text));
    const memory = {
      id: duplicate?.id ?? `memory-${now}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      kind: inferMemoryKind(text),
      createdAt: duplicate?.createdAt ?? now,
      updatedAt: now,
    };
    return {
      answer: "I’ll remember that.",
      memoryMutations: [{ type: "upsert", memory }],
      toolName: "remember_user_context",
      toolMessage: "Saved to memory",
    };
  }

  const query = normalizedText(queryValue);
  const clearAll = /\b(all|everything|every memory|all memories)\b/.test(query);
  const matches = clearAll ? memories : selectRelevantChatMemories(queryValue, memories, { limit: 1 });
  return {
    answer: matches.length === 0
      ? "I couldn’t find a matching memory to forget."
      : matches.length === 1
        ? "I’ve forgotten that."
        : `I’ve forgotten ${matches.length} memories.`,
    memoryMutations: matches.map((memory) => ({ type: "delete", memoryId: memory.id })),
    toolName: "forget_user_memory",
    toolMessage: matches.length === 0 ? "No matching memory found" : "Removed from memory",
  };
}

function normalizeMemory(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = cleanId(value.id);
  const text = String(value.text ?? "").trim().slice(0, MAX_MEMORY_TEXT_LENGTH);
  if (!id || !text) return null;
  const createdAt = finiteTimestamp(value.createdAt);
  return {
    id,
    text,
    kind: MEMORY_KINDS.has(value.kind) ? value.kind : "other",
    createdAt,
    updatedAt: finiteTimestamp(value.updatedAt, createdAt),
  };
}

export function normalizeChatMemories(value) {
  if (!Array.isArray(value)) return [];
  const byId = new Map();
  for (const candidate of value.slice(0, MAX_CHAT_MEMORIES)) {
    const memory = normalizeMemory(candidate);
    if (!memory) continue;
    const existing = byId.get(memory.id);
    if (!existing || memory.updatedAt >= existing.updatedAt) byId.set(memory.id, memory);
  }
  return Array.from(byId.values())
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_CHAT_MEMORIES);
}

export function selectRelevantChatMemories(queryValue, memoriesValue, { limit = 12 } = {}) {
  const memories = normalizeChatMemories(memoriesValue);
  const query = normalizedText(queryValue);
  const asksForInventory = /\b(what|show|list|tell)\b.*\b(remember|memories|about me)\b/.test(query);
  if (!query || asksForInventory) return memories.slice(0, Math.max(0, limit));
  const tokens = Array.from(new Set(query.split(/\s+/).filter((token) => token.length > 2)));
  const scored = memories.map((memory) => {
    const searchable = normalizedText(`${memory.kind} ${memory.text}`);
    const score = tokens.reduce((total, token) => total + (searchable.includes(token) ? 1 : 0), 0);
    return { memory, score };
  });
  const relevant = scored
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || right.memory.updatedAt - left.memory.updatedAt)
    .map(({ memory }) => memory);
  return relevant.slice(0, Math.max(0, limit));
}

export function applyChatMemoryMutations(memoriesValue, mutationsValue) {
  const memories = normalizeChatMemories(memoriesValue);
  if (!Array.isArray(mutationsValue)) return memories;
  const byId = new Map(memories.map((memory) => [memory.id, memory]));
  for (const candidate of mutationsValue.slice(0, 20)) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    if (candidate.type === "delete") {
      const memoryId = cleanId(candidate.memoryId);
      if (memoryId) byId.delete(memoryId);
      continue;
    }
    if (candidate.type !== "upsert") continue;
    const memory = normalizeMemory(candidate.memory);
    if (!memory) continue;
    const duplicate = Array.from(byId.values()).find((item) => normalizedText(item.text) === normalizedText(memory.text));
    if (duplicate && duplicate.id !== memory.id) byId.delete(duplicate.id);
    byId.set(memory.id, memory);
  }
  return normalizeChatMemories(Array.from(byId.values()));
}

export { MAX_CHAT_MEMORIES, MAX_MEMORY_TEXT_LENGTH, MEMORY_KINDS };
