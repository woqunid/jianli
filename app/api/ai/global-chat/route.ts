import { NextResponse } from "next/server"
import { createAiChatCompletion } from "@/lib/ai/client"
import { AiProviderError } from "@/lib/ai/http"
import { readAiRequestConfigFromBody } from "@/lib/ai/request-config"
import { buildGlobalAiMessages } from "@/lib/global-ai/prompt"
import { parseGlobalAiResponseText } from "@/lib/global-ai/response"
import type { GlobalAiMessage, GlobalAiRequest } from "@/types/global-ai"
import type { ResumeData } from "@/types/resume"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const HTTP_STATUS_INTERNAL_ERROR = 500
const GLOBAL_AI_TEMPERATURE = 0.2

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => {
      throw new Error("请求体不是合法 JSON")
    })
    const request = parseRequest(body)
    const requestConfig = readAiRequestConfigFromBody(body)
    const result = await createAiChatCompletion({
      messages: buildGlobalAiMessages(request),
      requestConfig,
      temperature: GLOBAL_AI_TEMPERATURE,
    })
    return NextResponse.json(parseGlobalAiResponseText(result.text))
  } catch (error) {
    const status = error instanceof AiProviderError ? error.status : HTTP_STATUS_INTERNAL_ERROR
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status })
  }
}

function parseRequest(value: unknown): GlobalAiRequest {
  const input = readRecord(value, "请求体")
  return {
    resumeData: readResumeData(input.resumeData),
    messages: readMessages(input.messages),
  }
}

function readResumeData(value: unknown): ResumeData {
  const resume = readRecord(value, "resumeData")
  if (!Array.isArray(resume.modules)) {
    throw new Error("resumeData.modules 必须是数组")
  }
  return resume as unknown as ResumeData
}

function readMessages(value: unknown): readonly GlobalAiMessage[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("messages 至少需要包含一条消息")
  }
  return value.map(readMessage)
}

function readMessage(value: unknown): GlobalAiMessage {
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

function readString(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${path} 必须是非空字符串`)
  }
  return value.trim()
}
