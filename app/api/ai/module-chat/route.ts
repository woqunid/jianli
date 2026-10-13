import { NextResponse } from "next/server"
import { createAiChatCompletion } from "@/lib/ai/client"
import { AiProviderError } from "@/lib/ai/http"
import { readAiRequestConfigFromBody } from "@/lib/ai/request-config"
import { buildModuleAiMessages, MODULE_AI_MAX_TOKENS } from "@/lib/module-ai/prompt"
import { applyModuleAiChanges } from "@/lib/module-ai/module-changes"
import { createConversationStream } from "@/lib/ai/conversation-stream"
import { parseModuleAiResponseText } from "@/lib/module-ai/response"
import type { ModuleAiMessage, ModuleAiRequest } from "@/types/module-ai"
import type { ResumeData, ResumeModule } from "@/types/resume"

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
    const requestConfig = readAiRequestConfigFromBody(body)
    return createConversationStream(req.signal, async (streamOptions) => {
      const result = await createAiChatCompletion({
        ...streamOptions,
        messages: buildModuleAiMessages(request),
        requestConfig,
        temperature: MODULE_AI_TEMPERATURE,
        maxTokens: MODULE_AI_MAX_TOKENS,
        stream: true,
        jsonResponse: true,
      })
      const response = parseModuleAiResponseText(result.text)
      if (response.changes.length) applyModuleAiChanges(request.module, response.changes)
      return response
    })
  } catch (error) {
    const status = error instanceof AiProviderError ? error.status : HTTP_STATUS_INTERNAL_ERROR
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status })
  }
}

function parseRequest(value: unknown): ModuleAiRequest {
  const input = readRecord(value, "请求体")
  const resumeData = readRecord(input.resumeData, "resumeData")
  if (!Array.isArray(resumeData.modules)) throw new Error("resumeData.modules 必须是数组")
  const module = readModule(input.module)
  const targetModule = resumeData.modules.find((item) => item && item.id === module.id)
  if (!targetModule) throw new Error("当前模块不在简历正文模块中")
  return {
    module: readModule(targetModule),
    resumeData: resumeData as unknown as ResumeData,
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
