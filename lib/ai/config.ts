import type { AiConfig, AiProvider } from "./types";

const DEFAULT_BASE_URLS: Readonly<Record<AiProvider, string>> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
};

const DEFAULT_MODELS: Readonly<Record<AiProvider, string>> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
  gemini: "gemini-2.5-flash",
};

const PROVIDERS = new Set<AiProvider>(["openai", "anthropic", "gemini"]);

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function readProvider(): AiProvider {
  const value = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (!PROVIDERS.has(value as AiProvider)) {
    throw new Error("AI_PROVIDER must be one of: openai, anthropic, gemini");
  }
  return value as AiProvider;
}

export function loadAiConfig(modelOverride?: string): AiConfig {
  const provider = readProvider();
  const baseUrl = process.env.AI_BASE_URL?.trim() || DEFAULT_BASE_URLS[provider];
  const model = modelOverride?.trim() || process.env.AI_MODEL?.trim() || DEFAULT_MODELS[provider];

  return {
    provider,
    apiKey: readRequiredEnv("AI_API_KEY"),
    baseUrl: baseUrl.replace(/\/+$/, ""),
    model,
  };
}
