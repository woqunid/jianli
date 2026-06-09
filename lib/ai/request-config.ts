import {
  AI_CLIENT_PROVIDERS,
  type AiClientProvider,
  type AiRequestConfig,
} from "@/types/ai-config"

const PROVIDERS = new Set<string>(AI_CLIENT_PROVIDERS)

export function readAiRequestConfigFromBody(body: unknown): AiRequestConfig | undefined {
  const input = readRecord(body, "请求体")
  return parseAiRequestConfig(input.aiConfig)
}

export function parseAiRequestConfig(value: unknown): AiRequestConfig | undefined {
  if (typeof value === "undefined") return undefined
  const input = readRecord(value, "AI 配置")
  const mode = readMode(input.mode)
  if (mode === "default") return { mode }
  return {
    mode,
    provider: readProvider(input.provider),
    apiKey: readNonEmptyString(input.apiKey, "AI_API_KEY"),
    ...readOptionalString(input.baseUrl, "AI_BASE_URL", "baseUrl"),
    ...readOptionalString(input.model, "AI_MODEL", "model"),
  }
}

function readMode(value: unknown): AiRequestConfig["mode"] {
  if (value !== "default" && value !== "custom") {
    throw new Error("AI 配置模式必须是 default 或 custom")
  }
  return value
}

function readProvider(value: unknown): AiClientProvider {
  if (typeof value === "undefined") return "openai"
  if (typeof value !== "string" || !PROVIDERS.has(value)) {
    throw new Error("AI 请求格式必须是 openai、gemini 或 anthropic")
  }
  return value as AiClientProvider
}

function readOptionalString(value: unknown, fieldName: string, outputKey: "baseUrl" | "model") {
  if (typeof value === "undefined") return {}
  if (typeof value !== "string") throw new Error(`${fieldName} 必须是字符串`)
  const text = value.trim()
  return text ? { [outputKey]: text } : {}
}

function readNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`自定义 AI 配置的 ${fieldName} 不能为空`)
  }
  return value.trim()
}

function readRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldName} 必须是 JSON 对象`)
  }
  return value as Record<string, unknown>
}
