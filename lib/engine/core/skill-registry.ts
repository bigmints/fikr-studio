export interface SkillStep {
  name: string;
  toolName: string;
  mapParams?: (context: any) => any;
  mapResult?: (result: any, context: any) => void;
}

export interface Skill {
  name: string;
  description: string;
  steps: SkillStep[];
}

export class SkillRegistry {
  private static instance: SkillRegistry;
  private skills: Map<string, Skill> = new Map();

  private constructor() {}

  public static getInstance(): SkillRegistry {
    if (!SkillRegistry.instance) {
      SkillRegistry.instance = new SkillRegistry();
    }
    return SkillRegistry.instance;
  }

  public register(skill: Skill) {
    this.skills.set(skill.name, skill);
  }

  public getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }
}

export const skillRegistry = SkillRegistry.getInstance();
