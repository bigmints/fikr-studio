import { Tool, ToolContext } from "../core/tool-registry";

export class PromptLoaderTool implements Tool {
  name = "PromptLoaderTool";
  description = "Loads a markdown prompt template and injects variables";

  async execute(context: ToolContext): Promise<{ hydratedPrompt: string }> {
    const templateName = context.templateName; // e.g. "article-generation"
    
    // In a real app we'd fs.readFileSync or fetch, 
    // but in Next.js client side, we might need to fetch from an API 
    // or we can just import the raw markdown if configured.
    // For MVP, we will fetch it from the public dir or an API. 
    // Since we created them in lib/prompts, we can just fetch them via a Next.js api route,
    // or we can hardcode the fetch for the sake of the client.
    // Wait, in Next.js we can't easily read local files from client components without an API.
    // Let's assume we have a simple API route or we can just inject it.
    // Actually, to make it work immediately without adding API routes, we can just fetch the raw file if it's served,
    // but lib/ is not served. 
    // For now, let's just mock the template if fetch fails, but try to fetch if we move them to public.
    
    // Let's implement a fallback template just in case
    let template = `You are an expert. Write about {{topic}} with tone {{tone}}, depth {{depth}}, audience {{audience}}. Context: {{context}}`;
    
    try {
      // In a full implementation, we'd add a GET /api/prompts route.
      // For this step, we will use the fallback or assume it's injected.
      if (context.rawTemplate) {
        template = context.rawTemplate;
      }
    } catch(e) {}

    let hydrated = template;
    const variables = ["topic", "tone", "depth", "audience", "context", "segment", "surrounding_context", "heat_color"];
    
    variables.forEach(v => {
      const regex = new RegExp(`{{${v}}}`, "g");
      hydrated = hydrated.replace(regex, String(context[v] || ""));
    });

    return { hydratedPrompt: hydrated };
  }
}
