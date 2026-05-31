import type { AiMessage } from "@/lib/ai/types"
import type { AiResumeRequest } from "@/types/ai-resume"

export interface ResumeSummary {
  readonly title: string
  readonly targetRole: string
  readonly jobIntentions: readonly ResumeIntentSummary[]
  readonly modules: readonly ResumeModuleSummary[]
}

export interface ResumeIntentSummary {
  readonly itemId: string
  readonly label: string
  readonly type: string
  readonly value: string
}

export interface ResumeModuleSummary {
  readonly moduleId: string
  readonly title: string
  readonly rows: readonly ResumeRowSummary[]
}

export interface ResumeRowSummary {
  readonly rowId: string
  readonly type: "rich" | "tags"
  readonly elements?: readonly ResumeElementSummary[]
  readonly tags?: readonly string[]
}

export interface ResumeElementSummary {
  readonly elementId: string
  readonly text: string
}

const SYSTEM_PROMPT = `你是专业中文简历优化助手。
你必须基于用户提供的简历、JD 和补充信息进行优化。
不得编造公司、学历、项目、指标、职责或成果。
如果信息不足，必须在 reason 中标记“需要用户补充”，不能虚构。
你只能针对输入摘要里存在的 itemId、moduleId、rowId、elementId 返回建议。
输出必须是严格 JSON，不要输出 Markdown、代码块或解释文本。`

const RESPONSE_SCHEMA = {
  summary: "整体匹配度说明",
  matchedKeywords: ["React", "Next.js", "TypeScript"],
  missingKeywords: ["性能优化", "工程化"],
  suggestions: [
    {
      target: {
        type: "moduleElement",
        moduleId: "模块 ID",
        rowId: "行 ID",
        elementId: "元素 ID",
        field: "content",
      },
      section: "projects",
      title: "项目经历优化",
      before: "必须等于当前简历摘要中的原文",
      after: "优化后的候选内容",
      reason: "说明依据，信息不足时写明需要用户补充",
    },
  ],
}

export function buildResumePrompt(request: AiResumeRequest, summary: ResumeSummary): readonly AiMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(request, summary) },
  ]
}

function buildUserPrompt(request: AiResumeRequest, summary: ResumeSummary): string {
  return [
    `目标岗位：${request.targetRole || summary.targetRole || "未填写"}`,
    `操作类型：${request.action}`,
    `优化范围：${request.sections.join(", ")}`,
    "Job Description：",
    request.jobDescription,
    "用户补充信息：",
    request.extraInfo || "无",
    "当前简历摘要（含可写回 ID）：",
    JSON.stringify(summary, null, 2),
    "返回 JSON schema：",
    JSON.stringify(RESPONSE_SCHEMA, null, 2),
  ].join("\n\n")
}
