import { createAiChatCompletion } from "@/lib/ai/client"
import { buildInterviewAdvicePrompt } from "@/lib/ai/interview-advice-prompt"
import { parseInterviewAdviceResponse } from "@/lib/ai/interview-advice-schema"
import { readSummaryPlainText, summarizeResume } from "@/lib/ai/resume-summary"
import type { AiRequestConfig } from "@/types/ai-config"
import type { AiInterviewAdviceRequest, AiInterviewAdviceResponse } from "@/types/interview-advice"

const INTERVIEW_MAX_TOKENS = 5000
const INTERVIEW_TEMPERATURE = 0.25

export async function createAiInterviewAdvice(
  request: AiInterviewAdviceRequest,
  requestConfig?: AiRequestConfig,
): Promise<AiInterviewAdviceResponse> {
  const summary = summarizeResume(request.resumeData, "")
  ensureResumeHasContent(summary)
  const result = await createAiChatCompletion({
    messages: buildInterviewAdvicePrompt(summary),
    requestConfig,
    temperature: INTERVIEW_TEMPERATURE,
    maxTokens: INTERVIEW_MAX_TOKENS,
  })
  return parseInterviewAdviceResponse(result.text)
}

function ensureResumeHasContent(summary: ReturnType<typeof summarizeResume>): void {
  if (readSummaryPlainText(summary)) return
  throw new Error("简历内容为空，无法生成有效面试建议")
}
