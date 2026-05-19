export interface ToolContext {
  [key: string]: any;
}

export interface Tool {
  name: string;
  description: string;
  execute(context: ToolContext): Promise<any>;
}

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, Tool> = new Map();

  private constructor() {}

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  public register(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  public getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  public async executeTool(name: string, context: ToolContext = {}): Promise<any> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found in registry`);
    }
    return await tool.execute(context);
  }
}

export const toolRegistry = ToolRegistry.getInstance();
