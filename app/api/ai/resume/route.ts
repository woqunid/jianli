import { NextResponse } from "next/server"
import { AiProviderError } from "@/lib/ai/http"
import { parseAiResumeRequest } from "@/lib/ai/resume-schema"
import { createAiResumeSuggestions } from "@/lib/ai/resume-service"

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
  try {
    request = parseAiResumeRequest(body)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: HTTP_STATUS_BAD_REQUEST })
  }

  try {
    const result = await createAiResumeSuggestions(request)
    return NextResponse.json(result)
  } catch (error) {
    const status = error instanceof AiProviderError ? error.status : HTTP_STATUS_INTERNAL_ERROR
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status })
  }
}
