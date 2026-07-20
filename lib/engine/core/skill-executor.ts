import { toolRegistry } from "./tool-registry";
import { skillRegistry } from "./skill-registry";

export class SkillExecutor {
  public static async execute(skillName: string, initialContext: any = {}): Promise<any> {
    const skill = skillRegistry.getSkill(skillName);
    if (!skill) {
      throw new Error(`Skill ${skillName} not found`);
    }

    const context = { ...initialContext };

    for (const step of skill.steps) {
      const toolParams = step.mapParams ? step.mapParams(context) : context;
      const result = await toolRegistry.executeTool(step.toolName, toolParams);
      if (step.mapResult) {
        step.mapResult(result, context);
      } else {
        // By default, just merge into context if it's an object
        if (typeof result === "object" && result !== null) {
          Object.assign(context, result);
        }
      }
    }

    return context;
  }
}
