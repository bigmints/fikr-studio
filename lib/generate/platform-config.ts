import type { Platform } from "./types";

export interface PlatformConfig {
  charLimit:    number | null;
  wordTarget:   [number, number];
  citationMode: "strip" | "footnote";
}

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  linkedin: {
    charLimit:    3000,
    wordTarget:   [400, 600],
    citationMode: "strip",
  },
  substack: {
    charLimit:    null,
    wordTarget:   [800, 2000],
    citationMode: "footnote",
  },
};
