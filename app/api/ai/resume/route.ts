import { NextResponse } from "next/server"
import { AiProviderError } from "@/lib/ai/http"
import { readAiRequestConfigFromBody } from "@/lib/ai/request-config"
import { parseAiResumeRequest } from "@/lib/ai/resume-schema"
import { createAiResumeSuggestions } from "@/lib/ai/resume-service"
import type { AiRequestConfig } from "@/types/ai-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const HTTP_STATUS_BAD_REQUEST = 400
const HTTP_STATUS_INTERNAL_ERROR = 500

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: HTTP_STATUS_BAD_REQUEST })
  }

  let request: ReturnType<typeof parseAiResumeRequest>
  let requestConfig: AiRequestConfig | undefined
  try {
    request = parseAiResumeRequest(body)
    requestConfig = readAiRequestConfigFromBody(body)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: HTTP_STATUS_BAD_REQUEST })
  }

  try {
    const result = await createAiResumeSuggestions(request, requestConfig)
    return NextResponse.json(result)
  } catch (error) {
    const status = error instanceof AiProviderError ? error.status : HTTP_STATUS_INTERNAL_ERROR
    const message = error instanceof Error ? error.message : String(error)
    console.error("[api/ai/resume] AI 简历处理失败", {
      action: request.action,
      status,
      message,
    })
    return NextResponse.json({ error: message }, { status })
  }
}
