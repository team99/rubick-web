export interface ModelConfig {
  id: string;
  name: string;
  provider: "anthropic" | "openai" | "google" | "qwen";
  modelId: string;
}

export const MODELS: ModelConfig[] = [
  {
    id: "qwen36-plus",
    name: "Qwen 3.6 Plus",
    provider: "qwen",
    modelId: "qwen3.6-plus",
  },
  {
    id: "gemini-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    modelId: "gemini-2.5-pro",
  },
];

export const DEFAULT_MODEL = MODELS[0].id;

export function getModelConfig(id: string): ModelConfig {
  return MODELS.find((m) => m.id === id) || MODELS[0];
}
