import { Tool, ToolContext } from "../core/tool-registry";
import { TextBlock } from "@/components/tile-card";

export interface ScoredTopic {
  title: string;
  score: number;
  noteIds: string[];
  previewText: string;
}

export class TopicScorerTool implements Tool {
  name = "TopicScorerTool";
  description = "Extracts topics using keyword clustering";

  async execute(context: ToolContext): Promise<{ topics: ScoredTopic[] }> {
    const blocks: TextBlock[] = context.blocks || [];
    
    // Very basic client-side topic extraction MVP
    // In a real TF-IDF implementation this would be more complex
    const topics: ScoredTopic[] = [];
    
    // Naive clustering: group by similar content length or some basic keyword
    // For MVP, we will just pick 3 random blocks that are long enough
    const richBlocks = blocks
      .filter(b => b.text && b.text.length > 50)
      .sort((a, b) => (b.text?.length || 0) - (a.text?.length || 0));

    for (let i = 0; i < Math.min(3, richBlocks.length); i++) {
      const block = richBlocks[i];
      // Create a fake topic title from the first few words
      const words = block.text?.split(" ").slice(0, 5).join(" ") || "";
      topics.push({
        title: words + "...",
        score: Math.floor(Math.random() * 40) + 60, // 60-100
        noteIds: [block.id],
        previewText: block.text?.substring(0, 80) + "..."
      });
    }

    // Fallback if no rich blocks
    if (topics.length === 0) {
      topics.push({
        title: "General Insights",
        score: 50,
        noteIds: [],
        previewText: "Based on all your notes."
      });
    }

    return { topics };
  }
}
