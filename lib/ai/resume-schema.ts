import type {
  AiResumeAction,
  AiGeneratedSection,
  AiResumeRequest,
  AiResumeResponse,
  AiResumeSection,
  AiResumeSuggestion,
  AiResumeSuggestionTarget,
} from "@/types/ai-resume"
import { AI_RESUME_ACTIONS, AI_RESUME_SECTIONS } from "@/types/ai-resume"

const ACTIONS = new Set<string>(AI_RESUME_ACTIONS)
const SECTIONS = new Set<string>(AI_RESUME_SECTIONS)
const ANALYZE_RESPONSE_KEYS = new Set<string>([
  "summary",
  "matchScore",
  "matchedKeywords",
  "missingKeywords",
  "improvementDirections",
])
const FIELD_NAMES: Readonly<Record<string, string>> = {
  "request body": "请求体",
  "AI response": "AI 响应",
  action: "操作类型",
  after: "优化后内容",
  before: "原内容",
  extraInfo: "补充信息",
  jobDescription: "岗位 JD",
  matchedKeywords: "匹配关键词",
  matchScore: "匹配度",
  missingKeywords: "缺失关键词",
  improvementDirections: "改进方向",
  generatedSections: "生成候选内容模块",
  "generatedSection.content": "候选内容",
  "generatedSection.section": "候选内容模块",
  "generatedSection.title": "候选内容标题",
  reason: "建议原因",
  resumeData: "简历数据",
  section: "优化范围",
  sections: "优化范围",
  suggestion: "优化建议",
  "suggestion.after": "优化建议的优化后内容",
  "suggestion.before": "优化建议的原内容",
  "suggestion.reason": "优化建议的原因",
  "suggestion.target": "优化建议的写回目标",
  "suggestion.title": "优化建议标题",
  suggestions: "优化建议列表",
  summary: "概要",
  "target.elementId": "目标内容元素 ID",
  "target.itemId": "目标求职意向 ID",
  "target.moduleId": "目标模块 ID",
  "target.rowId": "目标行 ID",
  "target.type": "目标类型",
  targetRole: "目标岗位",
}

export function parseAiResumeRequest(body: unknown): AiResumeRequest {
  const input = requireRecord(body, "request body")
  const action = requireEnum(input.action, ACTIONS, "action") as AiResumeAction
  const sections = requireArray(input.sections, "sections").map(readSection)
  return {
    action,
    sections,
    jobDescription: requireNonEmptyString(input.jobDescription, "jobDescription"),
    targetRole: requireString(input.targetRole, "targetRole"),
    resumeData: requireRecord(input.resumeData, "resumeData") as unknown as AiResumeRequest["resumeData"],
    extraInfo: requireString(input.extraInfo, "extraInfo"),
  }
}

export function parseAiResumeResponse(text: string, action?: AiResumeAction): AiResumeResponse {
  const data = parseJson(text)
  const input = requireRecord(data, "AI response")
  if (action === "analyze") {
    return readAnalyzeResponse(input)
  }
  const suggestions = requireArray(input.suggestions, "suggestions").map(readSuggestion)
  return {
    summary: requireString(input.summary, "summary"),
    matchScore: readOptionalNumber(input.matchScore, "matchScore"),
    matchedKeywords: readStringArray(input.matchedKeywords, "matchedKeywords"),
    missingKeywords: readStringArray(input.missingKeywords, "missingKeywords"),
    generatedSections: readOptionalGeneratedSections(input.generatedSections),
    suggestions,
  }
}

function readAnalyzeResponse(input: Record<string, unknown>): AiResumeResponse {
  assertAnalyzeResponseKeys(input)
  return {
    summary: requireString(input.summary, "summary"),
    matchScore: readOptionalNumber(input.matchScore, "matchScore"),
    matchedKeywords: readStringArray(input.matchedKeywords, "matchedKeywords"),
    missingKeywords: readStringArray(input.missingKeywords, "missingKeywords"),
    improvementDirections: readStringArray(input.improvementDirections, "improvementDirections"),
    suggestions: [],
  }
}

function assertAnalyzeResponseKeys(input: Record<string, unknown>): void {
  const invalidKeys = Object.keys(input).filter((key) => !ANALYZE_RESPONSE_KEYS.has(key))
  if (invalidKeys.length > 0) {
    throw new Error(`AI 分析响应包含不允许的字段：${invalidKeys.join("、")}`)
  }
}

function parseJson(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return parseJsonFromWrappedText(trimmed)
  }
}

function parseJsonFromWrappedText(text: string): unknown {
  const candidates = [readJsonFence(text), readJsonObject(text)].filter(isString)
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown
    } catch {
      continue
    }
  }
  throw new Error("AI 响应不是合法 JSON")
}

function isString(value: string | null): value is string {
  return typeof value === "string"
}

function readJsonFence(text: string): string | null {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return match?.[1]?.trim() || null
}

function readJsonObject(text: string): string | null {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start < 0 || end <= start) {
    return null
  }
  return text.slice(start, end + 1)
}

function readSuggestion(value: unknown): AiResumeSuggestion {
  const input = requireRecord(value, "suggestion")
  return {
    target: readTarget(input.target),
    section: readSection(input.section),
    title: requireString(input.title, "suggestion.title"),
    before: requireString(input.before, "suggestion.before"),
    after: requireString(input.after, "suggestion.after"),
    reason: requireString(input.reason, "suggestion.reason"),
  }
}

function readTarget(value: unknown): AiResumeSuggestionTarget {
  const input = requireRecord(value, "suggestion.target")
  const type = requireString(input.type, "target.type")
  if (type === "jobIntentionItem") {
    return { type, itemId: requireString(input.itemId, "target.itemId"), field: "value" }
  }
  if (type === "moduleElement") {
    return readModuleElementTarget(input)
  }
  if (type === "moduleTags") {
    return readModuleTagsTarget(input)
  }
  if (type === "moduleContent") {
    return readModuleContentTarget(input)
  }
  throw new Error(`不支持的写回目标类型：${type}`)
}

function readModuleElementTarget(input: Record<string, unknown>): AiResumeSuggestionTarget {
  return {
    type: "moduleElement",
    moduleId: requireString(input.moduleId, "target.moduleId"),
    rowId: requireString(input.rowId, "target.rowId"),
    elementId: requireString(input.elementId, "target.elementId"),
    field: "content",
  }
}

function readModuleTagsTarget(input: Record<string, unknown>): AiResumeSuggestionTarget {
  return {
    type: "moduleTags",
    moduleId: requireString(input.moduleId, "target.moduleId"),
    rowId: requireString(input.rowId, "target.rowId"),
    field: "tags",
  }
}

function readModuleContentTarget(input: Record<string, unknown>): AiResumeSuggestionTarget {
  return {
    type: "moduleContent",
    moduleId: requireString(input.moduleId, "target.moduleId"),
    field: "content",
  }
}

function readOptionalGeneratedSections(value: unknown): readonly AiGeneratedSection[] | undefined {
  if (value === undefined) return undefined
  return requireArray(value, "generatedSections").map(readGeneratedSection)
}

function readGeneratedSection(value: unknown): AiGeneratedSection {
  const input = requireRecord(value, "generatedSection")
  return {
    section: readSection(input.section),
    title: requireString(input.title, "generatedSection.title"),
    content: requireString(input.content, "generatedSection.content"),
  }
}

function readSection(value: unknown): AiResumeSection {
  return requireEnum(value, SECTIONS, "section") as AiResumeSection
}

function readOptionalNumber(value: unknown, name: string): number | undefined {
  if (value === undefined) return undefined
  return requireNumber(value, name)
}

function requireNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${getFieldName(name)} 必须是数字`)
  }
  return value
}

function readStringArray(value: unknown, name: string): readonly string[] {
  return requireArray(value, name).map((item) => requireString(item, name))
}

function requireArray(value: unknown, name: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${getFieldName(name)} 必须是数组`)
  }
  return value
}

function requireRecord(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${getFieldName(name)} 必须是 JSON 对象`)
  }
  return value as Record<string, unknown>
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw new Error(`${getFieldName(name)} 必须是字符串`)
  }
  return value
}

function requireNonEmptyString(value: unknown, name: string): string {
  const text = requireString(value, name)
  if (!text.trim()) {
    throw new Error(`${getFieldName(name)} 不能为空`)
  }
  return text
}

function requireEnum(value: unknown, options: ReadonlySet<string>, name: string): string {
  const text = requireString(value, name)
  if (!options.has(text)) {
    throw new Error(`${getFieldName(name)} 的值不受支持：${text}`)
  }
  return text
}

function getFieldName(name: string): string {
  return FIELD_NAMES[name] ?? name
}
