import { createAiChatCompletion } from "@/lib/ai/client"
import { buildResumePrompt, type ResumeSummary } from "@/lib/ai/resume-prompt"
import { REQUIRED_AI_RESUME_MODULES, validateAiResumeInput } from "@/lib/ai/resume-requirements"
import { parseAiResumeResponse } from "@/lib/ai/resume-schema"
import type { AiResumeRequest, AiResumeResponse } from "@/types/ai-resume"
import type { JSONContent, ResumeData, ResumeModule } from "@/types/resume"

const RESUME_MAX_TOKENS = 2800
const RESUME_TEMPERATURE = 0.2
const MIN_MATCH_SCORE = 0
const MAX_MATCH_SCORE = 100

export async function createAiResumeSuggestions(request: AiResumeRequest): Promise<AiResumeResponse> {
  validateAiResumeInput(request)
  const summary = summarizeResume(request.resumeData, request.targetRole)
  const messages = buildResumePrompt(request, summary)
  const result = await createAiChatCompletion({
    messages,
    temperature: RESUME_TEMPERATURE,
    maxTokens: RESUME_MAX_TOKENS,
  })
  const response = parseAiResumeResponse(result.text, request.action)
  validateAiResumeResponse(request, response)
  return response
}

function validateAiResumeResponse(request: AiResumeRequest, response: AiResumeResponse): void {
  if (request.action === "analyze") validateAnalyzeResponse(response)
  if (request.action === "generate") validateGenerateResponse(response)
}

function validateAnalyzeResponse(response: AiResumeResponse): void {
  const score = response.matchScore
  if (score === undefined) throw new Error("AI 响应缺少匹配度")
  if (!Number.isInteger(score) || score < MIN_MATCH_SCORE || score > MAX_MATCH_SCORE) {
    throw new Error("AI 响应的匹配度必须是 0 到 100 的整数")
  }
}

function validateGenerateResponse(response: AiResumeResponse): void {
  const sections = new Set((response.generatedSections ?? []).map((item) => item.section))
  const suggestionSections = new Set(response.suggestions.map((item) => item.section))
  const missing = REQUIRED_AI_RESUME_MODULES.filter((requirement) => {
    return !sections.has(requirement.section) || !suggestionSections.has(requirement.section)
  })
  if (missing.length > 0) {
    throw new Error(`AI 响应缺少候选内容模块：${missing.map((item) => item.label).join("、")}`)
  }
  if (response.suggestions.some((suggestion) => suggestion.target.type !== "moduleContent")) {
    throw new Error("AI 响应的生成候选内容建议必须写回到简历模块")
  }
}

function summarizeResume(resumeData: ResumeData, targetRole: string): ResumeSummary {
  const modules = readModules(resumeData)
  return {
    title: resumeData.title,
    targetRole: targetRole || findTargetRole(resumeData),
    jobIntentions: (resumeData.jobIntentionSection?.items ?? []).map((item) => ({
      itemId: item.id,
      label: item.label,
      type: item.type,
      value: item.value,
    })),
    modules: modules.map(summarizeModule),
  }
}

function summarizeModule(module: ResumeModule) {
  return {
    moduleId: module.id,
    title: module.title,
    rows: readRows(module).map((row) => summarizeRow(module.id, row)),
  }
}

function summarizeRow(moduleId: string, row: ResumeModule["rows"][number]) {
  if (row.type === "tags") {
    return { rowId: row.id, type: "tags" as const, tags: row.tags ?? [] }
  }
  const elements = readElements(moduleId, row)
  return {
    rowId: row.id,
    type: "rich" as const,
    elements: elements.map((element) => ({
      elementId: element.id,
      text: readJsonContentText(element.content),
    })),
  }
}

function readModules(resumeData: ResumeData): readonly ResumeModule[] {
  if (!Array.isArray(resumeData.modules)) {
    throw new Error("简历模块必须是数组")
  }
  return resumeData.modules
}

function readRows(module: ResumeModule): ResumeModule["rows"] {
  if (!Array.isArray(module.rows)) {
    throw new Error(`模块「${module.title || module.id}」的内容行必须是数组`)
  }
  return module.rows
}

function readElements(moduleId: string, row: ResumeModule["rows"][number]) {
  if (!Array.isArray(row.elements)) {
    throw new Error(`模块 ${moduleId} 的内容元素必须是数组`)
  }
  return row.elements
}

function findTargetRole(resumeData: ResumeData): string {
  const items = resumeData.jobIntentionSection?.items ?? []
  return items.find((item) => item.type === "position")?.value ?? ""
}

function readJsonContentText(content: JSONContent): string {
  const parts: string[] = []
  collectText(content, parts)
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim()
}

function collectText(node: JSONContent, parts: string[]): void {
  if (node.text) {
    parts.push(node.text)
  }
  if (node.type === "paragraph" && parts.length > 0) {
    parts.push("\n")
  }
  node.content?.forEach((child) => collectText(child, parts))
}
