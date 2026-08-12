import { AiProviderError } from "./http"
import type { AiProvider } from "./types"

const ANTHROPIC_VERSION = "2023-06-01"
const GEMINI_PAGE_SIZE = "1000"

export interface AiModelListConfig {
  readonly provider: AiProvider
  readonly apiKey: string
  readonly baseUrl: string
}

export async function listAiModels(config: AiModelListConfig): Promise<readonly string[]> {
  const request = normalizeConfig(config)
  if (request.provider === "openai") return listOpenAiModels(request)
  if (request.provider === "anthropic") return listAnthropicModels(request)
  return listGeminiModels(request)
}

async function listOpenAiModels(config: AiModelListConfig): Promise<readonly string[]> {
  const data = await getJson(joinUrl(config.baseUrl, "/models"), {
    authorization: `Bearer ${config.apiKey}`,
  })
  return readModelIds(data, "data")
}

async function listAnthropicModels(config: AiModelListConfig): Promise<readonly string[]> {
  const data = await getJson(joinUrl(config.baseUrl, "/models"), {
    "x-api-key": config.apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
  })
  return readModelIds(data, "data")
}

async function listGeminiModels(config: AiModelListConfig): Promise<readonly string[]> {
  const models: string[] = []
  let pageToken: string | undefined

  do {
    const url = createGeminiModelsUrl(config.baseUrl, pageToken)
    const data = await getJson(url.toString(), {
      "x-goog-api-key": config.apiKey,
    })
    models.push(...readGeminiModelIds(data))
    pageToken = readOptionalString(data, "nextPageToken")
  } while (pageToken)

  return uniqueSorted(models)
}

function createGeminiModelsUrl(baseUrl: string, pageToken?: string): URL {
  const url = new URL(joinUrl(baseUrl, "/models"))
  url.searchParams.set("pageSize", GEMINI_PAGE_SIZE)
  if (pageToken) url.searchParams.set("pageToken", pageToken)
  return url
}

async function getJson(url: string, headers: Readonly<Record<string, string>>): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, { method: "GET", headers })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`AI 模型列表请求无法连接：${message}`)
  }
  const text = await response.text()

  if (!response.ok) {
    throw new AiProviderError(response.status, `AI 模型列表请求失败（状态码 ${response.status}）：${text || response.statusText}`)
  }
  if (!text) return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    if (looksLikeHtml(text)) {
      throw new Error("AI 模型列表接口返回了 HTML 页面。请检查 Base URL 是否填成了网页地址，或是否多填了 /models、/responses、/messages 等接口后缀。")
    }
    throw new Error("AI 模型列表接口响应不是合法 JSON")
  }
}

function normalizeConfig(config: AiModelListConfig): AiModelListConfig {
  return {
    provider: config.provider,
    apiKey: readRequiredText(config.apiKey, "API Key"),
    baseUrl: readBaseUrl(config.baseUrl),
  }
}

function readBaseUrl(value: string): string {
  const text = readRequiredText(value, "Base URL").replace(/\/+$/, "")
  const url = new URL(text)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Base URL 必须使用 http 或 https 协议")
  }
  return text
}

function readModelIds(data: unknown, field: string): readonly string[] {
  const value = readRecord(data)[field]
  if (!Array.isArray(value)) throw new Error(`AI 模型列表响应缺少数组字段：${field}`)
  return uniqueSorted(value.map(readModelId))
}

function readGeminiModelIds(data: unknown): readonly string[] {
  const value = readRecord(data).models
  if (!Array.isArray(value)) throw new Error("Gemini 模型列表响应缺少数组字段：models")
  return value.filter(supportsGeminiGeneration).map(readGeminiModelId)
}

function supportsGeminiGeneration(value: unknown): boolean {
  const methods = readRecord(value).supportedGenerationMethods
  return Array.isArray(methods) && methods.includes("generateContent")
}

function readGeminiModelId(value: unknown): string {
  const input = readRecord(value)
  const id = readOptionalString(input, "baseModelId") || readRequiredText(input.name, "models[].name")
  return id.replace(/^models\//, "")
}

function readModelId(value: unknown): string {
  return readRequiredText(readRecord(value).id, "models[].id")
}

function readRequiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} 不能为空`)
  return value.trim()
}

function readOptionalString(value: unknown, field: string): string | undefined {
  const input = readRecord(value)[field]
  if (typeof input === "undefined" || input === null) return undefined
  if (typeof input !== "string") throw new Error(`${field} 必须是字符串`)
  return input.trim() || undefined
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI 模型列表响应必须是 JSON 对象")
  }
  return value as Record<string, unknown>
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl}${path}`
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right))
}

function looksLikeHtml(text: string): boolean {
  return /^\s*(<!doctype|<html|<body|<head)\b/i.test(text)
}
