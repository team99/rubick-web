export interface ModelConfig {
  id: string;
  name: string;
  provider: "anthropic" | "openai" | "google";
  modelId: string;
}

export const MODELS: ModelConfig[] = [
  {
    id: "claude-sonnet",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    modelId: "claude-sonnet-4-20250514",
  },
  {
    id: "claude-haiku",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    modelId: "claude-haiku-4-5-20251001",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    modelId: "gpt-4o",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    modelId: "gpt-4o-mini",
  },
  {
    id: "gemini-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    modelId: "gemini-2.5-pro-preview-05-06",
  },
  {
    id: "gemini-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    modelId: "gemini-2.5-flash-preview-04-17",
  },
];

export const DEFAULT_MODEL = MODELS[0].id;

export function getModelConfig(id: string): ModelConfig {
  return MODELS.find((m) => m.id === id) || MODELS[0];
}
