import { NextResponse } from "next/server"
import { AiProviderError } from "@/lib/ai/http"
import { createAiInterviewAdvice } from "@/lib/ai/interview-advice-service"
import { parseInterviewAdviceRequest } from "@/lib/ai/interview-advice-schema"
import { readAiRequestConfigFromBody } from "@/lib/ai/request-config"
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

  let request: ReturnType<typeof parseInterviewAdviceRequest>
  let requestConfig: AiRequestConfig | undefined
  try {
    request = parseInterviewAdviceRequest(body)
    requestConfig = readAiRequestConfigFromBody(body)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: HTTP_STATUS_BAD_REQUEST })
  }

  try {
    const result = await createAiInterviewAdvice(request, requestConfig)
    return NextResponse.json(result)
  } catch (error) {
    const status = error instanceof AiProviderError ? error.status : HTTP_STATUS_INTERNAL_ERROR
    const message = error instanceof Error ? error.message : String(error)
    console.error("[api/ai/interview-advice] AI 面试建议生成失败", {
      status,
      message,
    })
    return NextResponse.json({ error: message }, { status })
  }
}
