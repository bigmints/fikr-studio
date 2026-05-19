/**
 * Local AI Developer Configuration
 * Use this file to easily swap between local models during development.
 */

// Available models from your local LMStudio instance (localhost:1234)
export const LM_STUDIO_MODELS = {
  GEMMA_4_E4B: "google/gemma-4-e4b",
  GEMMA_4_E2B: "google/gemma-4-e2b",
  GEMMA_4_26B: "google/gemma-4-26b-a4b",
  LIQUID_1_2B: "liquid/lfm2-1.2b",
  LIQUID_2_5_1_2B: "liquid/lfm2.5-1.2b",
  NEMOTRON_NANO: "nvidia/nemotron-3-nano-4b",
  // Other models like kokoro, vieneu-tts, and nomic-embed are omitted as they aren't text-gen
  // Your old vLLM model
  GX10: "gx10-model"
};

export const LOCAL_AI_CONFIG = {
  // Set to true to bypass UI settings and use the local model below
  enabled: process.env.NODE_ENV === "development",

  // The base URL for your local LLM server (LMStudio default)
  baseUrl: "http://localhost:1234/v1",

  // To switch models, just change this value to another one from LM_STUDIO_MODELS
  model: LM_STUDIO_MODELS.GEMMA_4_26B,
};
