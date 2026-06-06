import { NextResponse } from "next/server"
import { createAiChatCompletion } from "@/lib/ai/client"
import { AiProviderError } from "@/lib/ai/http"
import { buildModuleAiMessages } from "@/lib/module-ai/prompt"
import { parseModuleAiResponseText } from "@/lib/module-ai/response"
import type { ModuleAiMessage, ModuleAiRequest } from "@/types/module-ai"
import type { ResumeModule } from "@/types/resume"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const HTTP_STATUS_INTERNAL_ERROR = 500
const MODULE_AI_TEMPERATURE = 0.2

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => {
      throw new Error("请求体不是合法 JSON")
    })
    const request = parseRequest(body)
    const result = await createAiChatCompletion({
      messages: buildModuleAiMessages(request),
      temperature: MODULE_AI_TEMPERATURE,
    })
    return NextResponse.json(parseModuleAiResponseText(result.text))
  } catch (error) {
    const status = error instanceof AiProviderError ? error.status : HTTP_STATUS_INTERNAL_ERROR
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status })
  }
}

function parseRequest(value: unknown): ModuleAiRequest {
  const input = readRecord(value, "请求体")
  return {
    module: readModule(input.module),
    messages: readMessages(input.messages),
  }
}

function readModule(value: unknown): ResumeModule {
  const module = readRecord(value, "module")
  const rows = module.rows
  if (!Array.isArray(rows)) {
    throw new Error("module.rows 必须是数组")
  }
  return {
    id: readString(module.id, "module.id"),
    title: readString(module.title, "module.title"),
    icon: typeof module.icon === "string" ? module.icon : undefined,
    order: readNumber(module.order, "module.order"),
    rows: rows as ResumeModule["rows"],
  }
}

function readMessages(value: unknown): readonly ModuleAiMessage[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("messages 至少需要包含一条消息")
  }
  return value.map(readMessage)
}

function readMessage(value: unknown): ModuleAiMessage {
  const message = readRecord(value, "messages[]")
  const role = readString(message.role, "message.role")
  if (role !== "user" && role !== "assistant") {
    throw new Error(`不支持的消息角色：${role}`)
  }
  return { role, content: readString(message.content, "message.content") }
}

function readRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} 必须是 JSON 对象`)
  }
  return value as Record<string, unknown>
}

function readNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path} 必须是有限数字`)
  }
  return value
}

function readString(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${path} 必须是非空字符串`)
  }
  return value.trim()
}
