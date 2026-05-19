import {
  Globe,
  Zap,
  HelpCircle,
  CheckSquare,
  Lightbulb,
  Link,
  Quote,
  BookOpen,
  MessageCircle,
  Sparkles,
  ScrollText,
  Scale,
  FileText,
  type LucideIcon,
} from "lucide-react"

export type ContentType =
  | "entity"
  | "claim"
  | "question"
  | "task"
  | "idea"
  | "reference"
  | "quote"
  | "definition"
  | "opinion"
  | "reflection"
  | "narrative"
  | "comparison"
  | "thesis"
  | "general"

export interface ContentTypeConfig {
  label: string
  icon: LucideIcon
  accentVar: string
  bodyStyle?: "thesis"
}

export const CONTENT_TYPE_CONFIG: Record<ContentType, ContentTypeConfig> = {
  entity: {
    label: "Entity",
    icon: Globe,
    accentVar: "var(--type-entity)",
  },
  claim: {
    label: "Claim",
    icon: Zap,
    accentVar: "var(--type-claim)",
  },
  question: {
    label: "Question",
    icon: HelpCircle,
    accentVar: "var(--type-question)",
  },
  task: {
    label: "Task",
    icon: CheckSquare,
    accentVar: "var(--type-task)",
  },
  idea: {
    label: "Idea",
    icon: Lightbulb,
    accentVar: "var(--type-idea)",
  },
  reference: {
    label: "Reference",
    icon: Link,
    accentVar: "var(--type-reference)",
  },
  quote: {
    label: "Quote",
    icon: Quote,
    accentVar: "var(--type-quote)",
  },
  definition: {
    label: "Definition",
    icon: BookOpen,
    accentVar: "var(--type-definition)",
  },
  opinion: {
    label: "Opinion",
    icon: MessageCircle,
    accentVar: "var(--type-opinion)",
  },
  reflection: {
    label: "Reflection",
    icon: Sparkles,
    accentVar: "var(--type-reflection)",
  },
  narrative: {
    label: "Narrative",
    icon: ScrollText,
    accentVar: "var(--type-narrative)",
  },
  comparison: {
    label: "Comparison",
    icon: Scale,
    accentVar: "var(--type-comparison)",
  },
  general: {
    label: "Note",
    icon: FileText,
    accentVar: "var(--type-general)",
  },
  thesis: {
    label: "Thesis",
    icon: Sparkles,
    accentVar: "var(--thesis-accent)", // Unique accent for synthesized thesis
  },
}

export const ALL_CONTENT_TYPES = Object.keys(CONTENT_TYPE_CONFIG) as ContentType[]
