import { createAiChatCompletion } from "@/lib/ai/client"
import { buildResumePrompt } from "@/lib/ai/resume-prompt"
import { validateAiResumeResponse } from "@/lib/ai/resume-response-validation"
import { validateAiResumeInput } from "@/lib/ai/resume-requirements"
import { parseAiResumeResponse } from "@/lib/ai/resume-schema"
import { summarizeResume } from "@/lib/ai/resume-summary"
import type { AiRequestConfig } from "@/types/ai-config"
import type { AiResumeRequest, AiResumeResponse } from "@/types/ai-resume"

const RESUME_MAX_TOKENS = 2800
const RESUME_TEMPERATURE = 0.2

export async function createAiResumeSuggestions(
  request: AiResumeRequest,
  requestConfig?: AiRequestConfig,
): Promise<AiResumeResponse> {
  validateAiResumeInput(request)
  const summary = summarizeResume(request.resumeData, request.targetRole)
  const messages = buildResumePrompt(request, summary)
  const result = await createAiChatCompletion({
    messages,
    requestConfig,
    temperature: RESUME_TEMPERATURE,
    maxTokens: RESUME_MAX_TOKENS,
  })
  const response = parseAiResumeResponse(result.text, request.action)
  validateAiResumeResponse(request, response)
  return response
}
