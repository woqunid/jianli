import { readTargetValue } from "@/lib/ai/resume-apply"
import { REQUIRED_AI_RESUME_MODULES } from "@/lib/ai/resume-requirements"
import type { AiResumeRequest, AiResumeResponse, AiResumeSuggestion } from "@/types/ai-resume"

const MIN_MATCH_SCORE = 0
const MAX_MATCH_SCORE = 100

export function validateAiResumeResponse(request: AiResumeRequest, response: AiResumeResponse): void {
  if (request.action === "analyze") {
    validateAnalyzeResponse(response)
    return
  }
  if (request.action === "optimize") validateWritableSuggestions(request, response.suggestions)
  if (request.action === "generate") {
    validateWritableSuggestions(request, response.suggestions)
    validateGenerateResponse(response)
  }
}

function validateAnalyzeResponse(response: AiResumeResponse): void {
  const score = response.matchScore
  if (score === undefined) throw new Error("AI 响应缺少匹配度")
  if (!Number.isInteger(score) || score < MIN_MATCH_SCORE || score > MAX_MATCH_SCORE) {
    throw new Error("AI 响应的匹配度必须是 0 到 100 的整数")
  }
}

function validateWritableSuggestions(
  request: AiResumeRequest,
  suggestions: readonly AiResumeSuggestion[],
): void {
  suggestions.forEach((suggestion) => validateWritableSuggestion(request, suggestion))
}

function validateWritableSuggestion(request: AiResumeRequest, suggestion: AiResumeSuggestion): void {
  const current = readTargetValue(request.resumeData, suggestion.target)
  if (current !== suggestion.before) {
    throw new Error(`AI 响应的 before 与当前原文不一致：${suggestion.title}`)
  }
}

function validateGenerateResponse(response: AiResumeResponse): void {
  const sections = new Set((response.generatedSections ?? []).map((item) => item.section))
  const suggestionSections = new Set(response.suggestions.map((item) => item.section))
  const expectedSections = new Set(REQUIRED_AI_RESUME_MODULES.map((requirement) => requirement.section))
  const unexpected = [...sections, ...suggestionSections].filter((section) => !expectedSections.has(section))
  const missing = REQUIRED_AI_RESUME_MODULES.filter((requirement) => {
    return !sections.has(requirement.section) || !suggestionSections.has(requirement.section)
  })
  if (unexpected.length > 0) {
    throw new Error(`AI 响应包含非目标候选内容模块：${[...new Set(unexpected)].join("、")}`)
  }
  if (missing.length > 0) {
    throw new Error(`AI 响应缺少候选内容模块：${missing.map((item) => item.label).join("、")}`)
  }
  if (response.suggestions.some((suggestion) => suggestion.target.type !== "moduleContent")) {
    throw new Error("AI 响应的生成候选内容建议必须写回到简历模块")
  }
}
