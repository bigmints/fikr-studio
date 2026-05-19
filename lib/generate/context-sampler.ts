import type { TextBlock } from "@/components/tile-card";

// Content-type weights for richness scoring (mirrors Flutter app priority)
const TYPE_WEIGHTS: Record<string, number> = {
  claim:    1.5,
  insight:  1.5,
  idea:     1.2,
  general:  1.0,
  task:     0.6,
  question: 0.8,
};

/**
 * Packs Intel canvas blocks into a budget-capped context string.
 * Hard cap: 48,000 characters (~12k tokens).
 * Prioritises by: (contentTypeWeight × recency)
 */
export function sampleContext(
  blocks: TextBlock[],
  budget: number = 48_000,
): { contextString: string; selectedNoteIds: string[] } {
  if (!blocks || blocks.length === 0) {
    return { contextString: "", selectedNoteIds: [] };
  }

  const now = Date.now();

  // Score each block
  const scored = blocks
    .filter((b) => b.text && b.text.trim().length > 10)
    .map((b) => {
      const typeWeight = TYPE_WEIGHTS[b.contentType ?? "general"] ?? 1.0;
      const ageMs = now - (b.timestamp || now);
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, 1 - ageDays / 90); // decays over 90 days
      return { block: b, score: typeWeight * (0.5 + 0.5 * recencyScore) };
    })
    .sort((a, b) => b.score - a.score);

  let contextString = "";
  const selectedNoteIds: string[] = [];
  let citationIndex = 1;

  for (const { block } of scored) {
    const entry = `\n[#${citationIndex}] (${block.contentType ?? "note"}): ${block.text}\n`;
    if (contextString.length + entry.length > budget) break;
    contextString += entry;
    selectedNoteIds.push(block.id);
    citationIndex++;
  }

  return { contextString, selectedNoteIds };
}
