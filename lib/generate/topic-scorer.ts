import type { TextBlock } from "@/components/tile-card";
import type { ScoredTopic } from "./types";

// Content-type weights
const TYPE_WEIGHTS: Record<string, number> = {
  claim: 1.5, insight: 1.5, idea: 1.2, general: 1.0, task: 0.6, question: 0.8,
};

const STOPWORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with",
  "is","are","was","were","be","been","have","has","had","do","does","did",
  "will","would","could","should","this","that","these","those","it","its",
  "we","i","you","they","he","she","my","our","your","their","also","just",
]);

/** TF-IDF-inspired keyword scorer. Returns top 3 topics, client-side, no LLM. */
export function scoreTopics(blocks: TextBlock[]): ScoredTopic[] {
  const richBlocks = blocks.filter(
    (b) => b.text && b.text.trim().length > 30,
  );

  if (richBlocks.length === 0) return [];

  // Step 1 — build term frequency per block
  const blockTerms: Map<string, number>[] = richBlocks.map((b) => {
    const tf = new Map<string, number>();
    const words = (b.text ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w));
    for (const w of words) tf.set(w, (tf.get(w) ?? 0) + 1);
    return tf;
  });

  // Step 2 — document frequency (how many blocks contain the term)
  const df = new Map<string, number>();
  for (const tf of blockTerms) {
    for (const term of tf.keys()) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  const N = richBlocks.length;

  // Step 3 — TF-IDF score each block
  const blockScores = richBlocks.map((block, idx) => {
    const tf = blockTerms[idx];
    let tfidfScore = 0;
    let topTerm = "";
    let topScore = 0;

    for (const [term, freq] of tf.entries()) {
      const idf = Math.log((N + 1) / ((df.get(term) ?? 0) + 1));
      const score = freq * idf;
      tfidfScore += score;
      if (score > topScore) { topScore = score; topTerm = term; }
    }

    const typeWeight = TYPE_WEIGHTS[block.contentType ?? "general"] ?? 1.0;
    return { block, score: tfidfScore * typeWeight, topTerm };
  });

  // Step 4 — cluster into 3 groups by top-term similarity (greedy)
  const used = new Set<number>();
  const topics: ScoredTopic[] = [];

  const sorted = [...blockScores].sort((a, b) => b.score - a.score);

  for (const seed of sorted) {
    if (topics.length >= 3) break;
    const seedIdx = blockScores.indexOf(seed);
    if (used.has(seedIdx)) continue;
    used.add(seedIdx);

    // Cluster related blocks (share ≥1 top-10 keyword)
    const seedTerms = new Set(
      [...blockTerms[seedIdx].entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([t]) => t),
    );

    const noteIds = [seed.block.id];
    for (let i = 0; i < blockScores.length; i++) {
      if (used.has(i)) continue;
      const shared = [...blockTerms[i].keys()].some((t) => seedTerms.has(t));
      if (shared) { used.add(i); noteIds.push(richBlocks[i].id); }
    }

    // Build title from top 5 words of seed block
    const titleWords = (seed.block.text ?? "")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w.toLowerCase()))
      .slice(0, 5)
      .join(" ");

    topics.push({
      title:       titleWords || seed.topTerm || "General Topic",
      score:       Math.min(100, Math.round(seed.score * 10)),
      noteIds,
      previewText: (seed.block.text ?? "").substring(0, 80) + "…",
    });
  }

  return topics;
}
