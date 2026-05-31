import { postJson, requireString } from "./http";
import type { AiChatResult, AiMessage, ProviderRequest } from "./types";

const DEFAULT_MAX_TOKENS = 1024;
const ANTHROPIC_VERSION = "2023-06-01";

function getMaxTokens(value?: number): number {
  return value ?? DEFAULT_MAX_TOKENS;
}

function splitSystem(messages: readonly AiMessage[]) {
  const system = messages.filter((item) => item.role === "system").map((item) => item.content).join("\n\n");
  const chat = messages.filter((item) => item.role !== "system");
  return { system, chat };
}

function getByPath(input: unknown, path: readonly (string | number)[]): unknown {
  return path.reduce<unknown>((current, key) => {
    if (typeof key === "number" && Array.isArray(current)) {
      return current[key];
    }
    if (typeof key === "string" && current && typeof current === "object") {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, input);
}

export async function callOpenAi(request: ProviderRequest): Promise<AiChatResult> {
  const { config, options } = request;
  const payload = {
    model: config.model,
    messages: options.messages,
    temperature: options.temperature,
    max_tokens: getMaxTokens(options.maxTokens),
  };
  const data = await postJson(`${config.baseUrl}/chat/completions`, {
    authorization: `Bearer ${config.apiKey}`,
  }, payload);
  const text = requireString(getByPath(data, ["choices", 0, "message", "content"]), "choices[0].message.content");
  return { provider: config.provider, model: config.model, text };
}

export async function callAnthropic(request: ProviderRequest): Promise<AiChatResult> {
  const { config, options } = request;
  const { system, chat } = splitSystem(options.messages);
  const payload = {
    model: config.model,
    messages: chat,
    max_tokens: getMaxTokens(options.maxTokens),
    temperature: options.temperature,
    ...(system ? { system } : {}),
  };
  const data = await postJson(`${config.baseUrl}/messages`, {
    "x-api-key": config.apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
  }, payload);
  const text = requireString(getByPath(data, ["content", 0, "text"]), "content[0].text");
  return { provider: config.provider, model: config.model, text };
}

function toGeminiRole(role: AiMessage["role"]): "user" | "model" {
  return role === "assistant" ? "model" : "user";
}

export async function callGemini(request: ProviderRequest): Promise<AiChatResult> {
  const { config, options } = request;
  const { system, chat } = splitSystem(options.messages);
  const payload = {
    contents: chat.map((message) => ({
      role: toGeminiRole(message.role),
      parts: [{ text: message.content }],
    })),
    generationConfig: {
      temperature: options.temperature,
      maxOutputTokens: getMaxTokens(options.maxTokens),
    },
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
  };
  const data = await postJson(`${config.baseUrl}/models/${config.model}:generateContent`, {
    "x-goog-api-key": config.apiKey,
  }, payload);
  const text = requireString(getByPath(data, ["candidates", 0, "content", "parts", 0, "text"]), "candidates[0].content.parts[0].text");
  return { provider: config.provider, model: config.model, text };
}
