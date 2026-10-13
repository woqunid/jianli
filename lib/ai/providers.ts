import { postJson, postResponse, requireString } from "./http";
import { readResponsesStream } from "./responses-stream";
import { readAiEventStream } from "./event-stream";
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
    stream: options.stream,
    ...(options.jsonResponse ? { text: { format: { type: "json_object" } } } : {}),
  };
  const headers = { authorization: `Bearer ${config.apiKey}` };
  let data: unknown;
  if (options.stream) {
    const response = await postResponse(`${config.baseUrl}/responses`, headers, payload, options.signal);
    data = response.headers.get("content-type")?.includes("text/event-stream")
      ? await readResponsesStream(response, options.onTextDelta)
      : await response.json();
  } else {
    data = await postJson(`${config.baseUrl}/responses`, headers, payload, options.signal);
  }
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
  const headers = {
    "x-api-key": config.apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
  };
  if (options.stream) {
    const response = await postResponse(`${config.baseUrl}/messages`, headers, { ...payload, stream: true }, options.signal);
    let text = "";
    const result = await readAiEventStream<string>(response, (event) => {
      if (event.type === "error") throw new Error(`AI 流式响应失败：${getByPath(event, ["error", "message"])}`);
      const delta = event.type === "content_block_start"
        ? getByPath(event, ["content_block", "text"])
        : getByPath(event, ["delta", "type"]) === "text_delta" ? getByPath(event, ["delta", "text"]) : undefined;
      if (typeof delta === "string" && delta) {
        text += delta;
        options.onTextDelta?.(delta);
      }
      if (event.type === "message_delta" && getByPath(event, ["delta", "stop_reason"]) === "max_tokens") {
        throw new Error("AI 服务输出不完整：max_tokens");
      }
      return event.type === "message_stop" ? requireString(text, "text") : undefined;
    });
    return { provider: config.provider, model: config.model, text: result };
  }
  const data = await postJson(`${config.baseUrl}/messages`, headers, payload, options.signal);
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
      ...(options.jsonResponse ? { responseMimeType: "application/json" } : {}),
    },
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
  };
  const headers = { "x-goog-api-key": config.apiKey };
  if (options.stream) {
    const response = await postResponse(`${config.baseUrl}/models/${config.model}:streamGenerateContent?alt=sse`, headers, payload, options.signal);
    let text = "";
    const result = await readAiEventStream<string>(response, (event) => {
      const error = getByPath(event, ["error", "message"]);
      if (error) throw new Error(`AI 流式响应失败：${error}`);
      const parts = getByPath(event, ["candidates", 0, "content", "parts"]);
      if (Array.isArray(parts)) {
        for (const part of parts) {
          const delta = getByPath(part, ["text"]);
          if (getByPath(part, ["thought"]) !== true && typeof delta === "string") {
            text += delta;
            options.onTextDelta?.(delta);
          }
        }
      }
      const reason = getByPath(event, ["candidates", 0, "finishReason"]);
      if (typeof reason === "string" && reason !== "STOP") throw new Error(`AI 服务输出不完整：${reason}`);
      return reason === "STOP" ? requireString(text, "text") : undefined;
    });
    return { provider: config.provider, model: config.model, text: result };
  }
  const data = await postJson(`${config.baseUrl}/models/${config.model}:generateContent`, headers, payload, options.signal);
  const text = requireString(getByPath(data, ["candidates", 0, "content", "parts", 0, "text"]), "candidates[0].content.parts[0].text");
  return { provider: config.provider, model: config.model, text };
}
