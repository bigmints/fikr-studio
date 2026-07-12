import {
  embedText,
  embedBatch,
  cosineSimilarity,
  isModelLoaded,
} from "@/lib/embeddings";

// Import TextBlock for internal use + re-export for callers.
import { type TextBlock } from "@/components/tile-card";
export { type TextBlock };

/** Default threshold below which a relevance match is ignored. */
const DEFAULT_SIMILARITY_THRESHOLD = 0.3;

/** Per-type thresholds based on confidence and content type requirements */
const TYPE_THRESHOLDS: Record<string, number> = {
  claim: 0.7,
  reflection: 0.25,
};

/** Default maximum number of results returned by search(). */
const DEFAULT_LIMIT = 20;

/** Internal representation of a single indexed note. */
interface IndexEntry {
  blockId: string;
  projectId: string;
  embedding: Float32Array;
  /** The exact text string that was embedded (useful for debugging). */
  text: string;
  contentType: string;
  confidence?: number | null;
}

/**
 * In-memory vector index for deterministic lexical relevance search.
 *
 * Each note is represented by a dependency-free 384-dimensional feature vector.
 * Search projects the query using the same tokenizer and ranks cosine similarity.
 *
 * Typical usage:
 *
 *   await vectorIndex.add(block.id, project.id, block.text);
 *   const hits = await vectorIndex.search("my idea about X");
 *
 *   // Bulk rebuild (e.g. after loading projects from storage)
 *   await vectorIndex.reindex(projects);
 */
export class VectorIndex {
  private entries: Map<string, IndexEntry>;

  constructor() {
    this.entries = new Map();
  }

  /**
   * Build the text string that will be embedded for a given block.
   * Combines `text` and `annotation` (if present) with a " | " separator.
   */
  static buildIndexText(block: { text: string; title?: string; annotation?: string; contentType?: string; category?: string; }): string {
    const parts: string[] = [];
    if (block.contentType) parts.push(`type:${block.contentType}`);
    if (block.category) parts.push(`category:${block.category}`);
    if (block.title) parts.push(block.title);
    parts.push(block.text);
    if (block.annotation) {
      parts.push(block.annotation);
    }
    return parts.join(" | ");
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Add or update a single note in the index.
   *
   * @param blockId - Unique identifier for the note (TextBlock.id).
   * @param projectId - The project that owns this note.
   * @param textToEmbed - The text to embed (usually TextBlock.text, optionally joined with annotation).
   * @param embedding - Optional pre-computed embedding. When omitted, `embedText()` is called.
   */
  async add(
    blockId: string,
    projectId: string,
    textToEmbed: string,
    contentType: string = "general",
    confidence?: number | null,
    embedding?: Float32Array,
  ): Promise<void> {
    if (!isModelLoaded()) {
      throw new Error(
        "VectorIndex.add: local search index is not ready yet.",
      );
    }

    const vec = embedding ?? (await embedText(textToEmbed));

    this.entries.set(blockId, {
      blockId,
      projectId,
      embedding: vec,
      text: textToEmbed,
      contentType,
      confidence,
    });
  }

  /**
   * Remove a single note from the index.
   *
   * @param blockId - The identifier of the note to remove.
   */
  remove(blockId: string): void {
    this.entries.delete(blockId);
  }

  /**
   * Search the index for notes relevant to the query.
   *
   * @param query - Free-text query to match against indexed notes.
   * @param limit - Maximum number of results to return (default 20).
   * @returns Array of matches sorted by descending cosine similarity score.
   *          Results with a score below 0.3 are filtered out.
   */
  async search(
    query: string,
    limit: number = DEFAULT_LIMIT,
  ): Promise<Array<{ blockId: string; projectId: string; score: number }>> {
    // Edge case: empty query is meaningless for relevance search.
    if (!query || !query.trim()) {
      return [];
    }

    if (!isModelLoaded()) {
      throw new Error(
        "VectorIndex.search: local search index is not ready yet.",
      );
    }

    const entries = Array.from(this.entries.values());

    // Edge case: nothing to search.
    if (entries.length === 0) {
      return [];
    }

    const queryVec = await embedText(query.trim());

    const scored: Array<{ blockId: string; projectId: string; score: number }> = [];

    for (const entry of entries) {
      const score = cosineSimilarity(queryVec, entry.embedding);
      
      let threshold = TYPE_THRESHOLDS[entry.contentType] ?? DEFAULT_SIMILARITY_THRESHOLD;
      if (entry.confidence != null && entry.confidence > 80) {
        // High confidence notes match easier
        threshold = Math.max(0.2, threshold - 0.1);
      }
      
      if (score >= threshold) {
        scored.push({
          blockId: entry.blockId,
          projectId: entry.projectId,
          score,
        });
      }
    }

    // Sort by score descending, then slice to the requested limit.
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  /**
   * Rebuild the entire index from scratch using all blocks across all projects.
   *
   * Existing entries are cleared first. Uses `embedBatch()` for efficiency.
   * Blocks whose embedding fails are skipped (warning logged) so one bad
   * note doesn't break the entire index.
   *
   * @param projects - Array of project objects, each containing an array of TextBlocks and ghostNotes.
   */
  async reindex(projects: Array<{ id: string; blocks: TextBlock[]; ghostNotes?: { id: string; text: string; category: string }[] }>): Promise<void> {
    if (!isModelLoaded()) {
      throw new Error(
        "VectorIndex.reindex: local search index is not ready yet.",
      );
    }

    // Clear any previous index.
    this.clear();

    // Collect all indexable blocks.
    type BatchItem = { blockId: string; projectId: string; textToEmbed: string; contentType: string; confidence?: number | null };
    const batchItems: BatchItem[] = [];

    for (const project of projects) {
      for (const block of project.blocks) {
        const textToEmbed = VectorIndex.buildIndexText(block);
        if (textToEmbed.trim()) {
          batchItems.push({
            blockId: block.id,
            projectId: project.id,
            textToEmbed,
            contentType: block.contentType,
            confidence: block.confidence,
          });
        }
      }
      
      // Index ghost notes as well
      if (project.ghostNotes) {
        for (const ghost of project.ghostNotes) {
          const textToEmbed = VectorIndex.buildIndexText({ text: ghost.text, contentType: "thesis", category: ghost.category });
          if (textToEmbed.trim()) {
            batchItems.push({
              blockId: ghost.id,
              projectId: project.id,
              textToEmbed,
              contentType: "thesis",
              confidence: 90, // ghost notes are generated synthese, so assume high confidence
            });
          }
        }
      }
    }

    if (batchItems.length === 0) {
      return;
    }

    // Batch-embed all texts at once.
    let embeddings: Float32Array[];
    try {
      embeddings = await embedBatch(batchItems.map((item) => item.textToEmbed));
    } catch (error) {
      console.warn("[VectorIndex] Batch embedding failed, falling back to individual embedding:", error);
      // Fallback: embed one by one so we still get what we can.
      embeddings = [];
      for (let i = 0; i < batchItems.length; i++) {
        try {
          embeddings[i] = await embedText(batchItems[i].textToEmbed);
        } catch {
          console.warn(
            `[VectorIndex] Skipping block ${batchItems[i].blockId}: embedding failed`,
          );
          embeddings[i] = new Float32Array(0); // sentinel
        }
      }
    }

    // Insert entries, skipping any that failed to embed.
    for (let i = 0; i < batchItems.length; i++) {
      const item = batchItems[i];
      const vec = embeddings[i];
      if (!vec || vec.length === 0) {
        console.warn(
          `[VectorIndex] Skipping block ${item.blockId}: embedding was empty or missing`,
        );
        continue;
      }

      this.entries.set(item.blockId, {
        blockId: item.blockId,
        projectId: item.projectId,
        embedding: vec,
        text: item.textToEmbed,
        contentType: item.contentType,
        confidence: item.confidence,
      });
    }
  }

  /**
   * Return the number of notes currently in the index.
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * Remove all entries from the index.
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Check whether a particular block is currently indexed.
   *
   * @param blockId - The identifier to check.
   */
  has(blockId: string): boolean {
    return this.entries.has(blockId);
  }
}

/**
 * Singleton vector index shared across the application.
 */

/**
 * Simple text-based search as a fallback when the embedding model is unavailable.
 * Uses basic token overlap scoring against indexed text.
 *
 * @param query - Search query string.
 * @param blocks - Flat list of blocks to search over.
 * @param limit - Maximum number of results.
 * @returns Array of results sorted by relevance score (0-1).
 */
export function textSearch(
  query: string,
  blocks: Array<{ id: string; text: string; contentType: string }>,
  limit: number = 20,
): Array<{ blockId: string; score: number }> {
  if (!query || !query.trim()) return [];

  const tokens = query.toLowerCase().split(/\s+/);
  if (tokens.length === 0) return [];

  const scored: Array<{ blockId: string; score: number }> = [];

  for (const block of blocks) {
    const textLower = (block.text || '').toLowerCase();
    let matchScore = 0;

    for (const token of tokens) {
      if (textLower.includes(token)) {
        matchScore += 1 / tokens.length;
      }
    }

    if (matchScore > 0) {
      scored.push({ blockId: block.id, score: Math.min(matchScore, 1) });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

export const vectorIndex = new VectorIndex();
