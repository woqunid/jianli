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

function readResponsesText(data: unknown): string {
  const directText = getByPath(data, ["output_text"]);
  if (typeof directText === "string" && directText.trim()) {
    return directText.trim();
  }

  const output = getByPath(data, ["output"]);
  if (!Array.isArray(output)) {
    throw new Error("AI Responses 响应缺少 output 数组");
  }

  const texts = output.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) {
      return [];
    }
    return content.flatMap((part) => {
      if (!part || typeof part !== "object") {
        return [];
      }
      const record = part as Record<string, unknown>;
      return record.type === "output_text" && typeof record.text === "string" && record.text.trim()
        ? [record.text.trim()]
        : [];
    });
  });

  if (texts.length === 0) {
    throw new Error("AI Responses 响应中没有可用的 output_text 内容");
  }
  return texts.join("\n");
}

export async function callOpenAi(request: ProviderRequest): Promise<AiChatResult> {
  const { config, options } = request;
  const payload = {
    model: config.model,
    input: options.messages,
    temperature: options.temperature,
    max_output_tokens: getMaxTokens(options.maxTokens),
  };
  const data = await postJson(`${config.baseUrl}/responses`, {
    authorization: `Bearer ${config.apiKey}`,
  }, payload);
  const text = readResponsesText(data);
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
