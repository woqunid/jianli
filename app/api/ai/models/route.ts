import { NextResponse } from "next/server"
import { AiProviderError } from "@/lib/ai/http"
import { listAiModels } from "@/lib/ai/model-list"
import { AI_CLIENT_PROVIDERS, type AiClientProvider } from "@/types/ai-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const HTTP_STATUS_BAD_REQUEST = 400
const HTTP_STATUS_INTERNAL_ERROR = 500
const PROVIDERS = new Set<string>(AI_CLIENT_PROVIDERS)

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: HTTP_STATUS_BAD_REQUEST })
  }

  let config: ReturnType<typeof parseModelListRequest>
  try {
    config = parseModelListRequest(body)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: HTTP_STATUS_BAD_REQUEST })
  }

  try {
    return NextResponse.json({ models: await listAiModels(config) })
  } catch (error) {
    const status = error instanceof AiProviderError ? error.status : HTTP_STATUS_INTERNAL_ERROR
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status })
  }
}

function parseModelListRequest(value: unknown) {
  const input = readRecord(value, "请求体")
  return {
    provider: readProvider(input.provider),
    apiKey: readNonEmptyString(input.apiKey, "API Key"),
    baseUrl: readNonEmptyString(input.baseUrl, "Base URL"),
  }
}

function readProvider(value: unknown): AiClientProvider {
  if (typeof value !== "string" || !PROVIDERS.has(value)) {
    throw new Error("AI 请求格式必须是 openai、gemini 或 anthropic")
  }
  return value as AiClientProvider
}

function readNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} 不能为空`)
  return value.trim()
}

function readRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} 必须是 JSON 对象`)
  }
  return value as Record<string, unknown>
}
