import type {
  AiInterviewAdviceRequest,
  AiInterviewAdviceResponse,
  InterviewAdviceItem,
  InterviewAdviceSection,
  InterviewQuestion,
  InterviewSelfIntroduction,
} from "@/types/interview-advice"

const FIELD_NAMES: Readonly<Record<string, string>> = {
  "AI response": "AI 响应",
  actions: "准备动作",
  adviceSections: "面试建议分组",
  answer: "参考答案",
  category: "问题类型",
  content: "自我介绍内容",
  detail: "准备项说明",
  focus: "准备主题重点",
  keyPoints: "自我介绍要点",
  overview: "总览",
  question: "面试问题",
  questions: "可能面试问题",
  request: "请求体",
  resumeBasis: "简历依据",
  resumeData: "简历数据",
  selfIntroduction: "自我介绍",
  targetRole: "目标岗位",
  title: "标题",
  workNature: "工作性质",
}

export function parseInterviewAdviceRequest(body: unknown): AiInterviewAdviceRequest {
  const input = requireRecord(body, "request")
  return {
    resumeData: requireRecord(input.resumeData, "resumeData") as unknown as AiInterviewAdviceRequest["resumeData"],
    targetRole: requireString(input.targetRole, "targetRole"),
  }
}

export function parseInterviewAdviceResponse(text: string): AiInterviewAdviceResponse {
  const input = requireRecord(parseJson(text), "AI response")
  return {
    overview: requireNonEmptyString(input.overview, "overview"),
    workNature: requireNonEmptyString(input.workNature, "workNature"),
    adviceSections: requireNonEmptyArray(input.adviceSections, "adviceSections").map(readAdviceSection),
    selfIntroduction: readSelfIntroduction(input.selfIntroduction),
    questions: requireNonEmptyArray(input.questions, "questions").map(readQuestion),
  }
}

function readAdviceSection(value: unknown): InterviewAdviceSection {
  const input = requireRecord(value, "adviceSections")
  return {
    title: requireNonEmptyString(input.title, "title"),
    focus: requireNonEmptyString(input.focus, "focus"),
    items: requireNonEmptyArray(input.items, "adviceSections").map(readAdviceItem),
  }
}

function readAdviceItem(value: unknown): InterviewAdviceItem {
  const input = requireRecord(value, "adviceSections")
  return {
    title: requireNonEmptyString(input.title, "title"),
    detail: requireNonEmptyString(input.detail, "detail"),
    actions: readStringArray(input.actions, "actions"),
  }
}

function readSelfIntroduction(value: unknown): InterviewSelfIntroduction {
  const input = requireRecord(value, "selfIntroduction")
  return {
    content: requireNonEmptyString(input.content, "content"),
    keyPoints: readStringArray(input.keyPoints, "keyPoints"),
  }
}

function readQuestion(value: unknown): InterviewQuestion {
  const input = requireRecord(value, "questions")
  return {
    category: requireNonEmptyString(input.category, "category"),
    question: requireNonEmptyString(input.question, "question"),
    answer: requireNonEmptyString(input.answer, "answer"),
    resumeBasis: requireNonEmptyString(input.resumeBasis, "resumeBasis"),
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
  throw new Error("AI 面试建议响应不是合法 JSON")
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
  if (start < 0 || end <= start) return null
  return text.slice(start, end + 1)
}

function readStringArray(value: unknown, name: string): readonly string[] {
  return requireNonEmptyArray(value, name).map((item) => requireNonEmptyString(item, name))
}

function requireNonEmptyArray(value: unknown, name: string): readonly unknown[] {
  const items = requireArray(value, name)
  if (items.length === 0) throw new Error(`${getFieldName(name)}不能为空`)
  return items
}

function requireArray(value: unknown, name: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${getFieldName(name)}必须是数组`)
  return value
}

function requireRecord(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${getFieldName(name)}必须是 JSON 对象`)
  }
  return value as Record<string, unknown>
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string") throw new Error(`${getFieldName(name)}必须是字符串`)
  return value
}

function requireNonEmptyString(value: unknown, name: string): string {
  const text = requireString(value, name)
  if (!text.trim()) throw new Error(`${getFieldName(name)}不能为空`)
  return text
}

function getFieldName(name: string): string {
  return FIELD_NAMES[name] ?? name
}
