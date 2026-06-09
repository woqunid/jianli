import {
  AI_CLIENT_PROVIDERS,
  AI_CONFIG_MODES,
  DEFAULT_AI_CLIENT_CONFIG,
  type AiClientConfig,
  type AiClientProvider,
  type AiConfigMode,
  type AiRequestConfig,
} from "@/types/ai-config"

const AI_CONFIG_STORAGE_KEY = "resume-ai-client-config:v1"
const PROVIDERS = new Set<string>(AI_CLIENT_PROVIDERS)
const MODES = new Set<string>(AI_CONFIG_MODES)

export function loadAiClientConfig(): AiClientConfig {
  ensureClient()
  const raw = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY)
  if (!raw) return DEFAULT_AI_CLIENT_CONFIG
  return parseStoredConfig(JSON.parse(raw) as unknown)
}

export function saveAiClientConfig(config: AiClientConfig): AiClientConfig {
  ensureClient()
  const normalized = normalizeConfig(config)
  window.localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}

export function withStoredAiRequestConfig(body: unknown): unknown {
  const requestConfig = readStoredAiRequestConfig()
  if (!requestConfig) return body
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("AI 请求体必须是 JSON 对象")
  }
  return { ...(body as Record<string, unknown>), aiConfig: requestConfig }
}

function readStoredAiRequestConfig(): AiRequestConfig | undefined {
  const config = loadAiClientConfig()
  if (config.mode === "default") return undefined
  return {
    mode: "custom",
    provider: config.provider,
    apiKey: requireNonEmpty(config.apiKey, "API Key"),
    ...readOptionalConfigText(config.baseUrl, "baseUrl"),
    ...readOptionalConfigText(config.model, "model"),
  }
}

function normalizeConfig(config: AiClientConfig): AiClientConfig {
  const mode = readMode(config.mode)
  if (mode === "default") return DEFAULT_AI_CLIENT_CONFIG
  const provider = readProvider(config.provider)
  const normalized = {
    mode,
    provider,
    apiKey: config.apiKey.trim(),
    baseUrl: config.baseUrl.trim(),
    model: config.model.trim(),
  }
  if (mode === "custom") requireNonEmpty(normalized.apiKey, "API Key")
  return normalized
}

function parseStoredConfig(value: unknown): AiClientConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("本地 AI 配置必须是 JSON 对象")
  }
  const input = value as Record<string, unknown>
  return normalizeConfig({
    mode: readMode(input.mode),
    provider: readProvider(input.provider ?? DEFAULT_AI_CLIENT_CONFIG.provider),
    apiKey: readString(input.apiKey, "API Key"),
    baseUrl: readString(input.baseUrl, "Base URL"),
    model: readString(input.model, "模型"),
  })
}

function readOptionalConfigText(value: string, field: "baseUrl" | "model") {
  const text = value.trim()
  return text ? { [field]: text } : {}
}

function ensureClient(): void {
  if (typeof window === "undefined") {
    throw new Error("只能在浏览器环境中读取 AI 配置")
  }
}

function readMode(value: unknown): AiConfigMode {
  if (typeof value === "undefined") return DEFAULT_AI_CLIENT_CONFIG.mode
  if (typeof value !== "string" || !MODES.has(value)) {
    throw new Error("AI 配置模式必须是 default 或 custom")
  }
  return value as AiConfigMode
}

function readProvider(value: unknown): AiClientProvider {
  if (typeof value === "undefined") return DEFAULT_AI_CLIENT_CONFIG.provider
  if (typeof value !== "string" || !PROVIDERS.has(value)) {
    throw new Error("AI 请求格式必须是 openai、gemini 或 anthropic")
  }
  return value as AiClientProvider
}

function readString(value: unknown, field: string): string {
  if (typeof value === "undefined") return ""
  if (typeof value !== "string") throw new Error(`${field} 必须是字符串`)
  return value
}

function requireNonEmpty(value: string, field: string): string {
  const text = value.trim()
  if (!text) throw new Error(`自定义 AI 配置的 ${field} 不能为空`)
  return text
}
