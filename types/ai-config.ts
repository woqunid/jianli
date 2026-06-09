export const AI_CONFIG_MODES = ["default", "custom"] as const

export const AI_CLIENT_PROVIDERS = ["openai", "gemini", "anthropic"] as const

export type AiConfigMode = (typeof AI_CONFIG_MODES)[number]

export type AiClientProvider = (typeof AI_CLIENT_PROVIDERS)[number]

export interface AiClientConfig {
  readonly mode: AiConfigMode
  readonly provider: AiClientProvider
  readonly apiKey: string
  readonly baseUrl: string
  readonly model: string
}

export interface AiDefaultRequestConfig {
  readonly mode: "default"
}

export interface AiCustomRequestConfig {
  readonly mode: "custom"
  readonly provider: AiClientProvider
  readonly apiKey: string
  readonly baseUrl?: string
  readonly model?: string
}

export type AiRequestConfig = AiDefaultRequestConfig | AiCustomRequestConfig

export const DEFAULT_AI_CLIENT_CONFIG: AiClientConfig = {
  mode: "default",
  provider: "openai",
  apiKey: "",
  baseUrl: "",
  model: "",
}
