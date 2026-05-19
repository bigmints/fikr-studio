import { Tool, ToolContext } from "../core/tool-registry";
import { TextBlock } from "@/components/tile-card"; // Using existing types

export class ContextSamplerTool implements Tool {
  name = "ContextSamplerTool";
  description = "Packs Fikr Intel blocks into a budgeted context string";

  async execute(context: ToolContext): Promise<any> {
    const blocks: TextBlock[] = context.blocks || [];
    const budget = context.budget || 48000;

    // Sort by timestamp desc to prefer newest
    const sorted = [...blocks].sort((a, b) => b.timestamp - a.timestamp);

    let contextString = "";
    const selectedNoteIds: string[] = [];
    let currentLength = 0;
    let citationIndex = 1;

    for (const block of sorted) {
      const blockString = `\n[#${citationIndex}] (${block.contentType || "note"}): ${block.text}\n`;
      if (currentLength + blockString.length > budget) {
        break; // Reached budget
      }
      contextString += blockString;
      selectedNoteIds.push(block.id);
      currentLength += blockString.length;
      citationIndex++;
    }

    return {
      contextString,
      selectedNoteIds
    };
  }
}
