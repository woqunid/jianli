import type { AiMessage } from "@/lib/ai/types"
import { findModuleByRequirement, REQUIRED_AI_RESUME_MODULES } from "@/lib/ai/resume-requirements"
import type { AiResumeAction, AiResumeRequest, AiResumeSection } from "@/types/ai-resume"

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

const EXAMPLE_MATCH_SCORE = 82

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

const ANALYZE_RESPONSE_SCHEMA = {
  summary: "整体匹配度说明，必须包含对岗位适配情况的简短判断",
  matchScore: EXAMPLE_MATCH_SCORE,
  matchedKeywords: ["已匹配的 JD 能力或关键词"],
  missingKeywords: ["尚未体现或证据不足的 JD 能力或关键词"],
  suggestions: RESPONSE_SCHEMA.suggestions,
}

const GENERATE_RESPONSE_SCHEMA = {
  summary: "说明候选内容如何对应 JD、目标岗位和用户补充信息",
  matchedKeywords: ["用于生成候选内容的 JD 关键词"],
  missingKeywords: ["因用户未提供真实信息而无法生成的关键词"],
  generatedSections: [
    {
      section: "skills",
      title: "专业技能",
      content: "给专业技能模块的候选内容",
    },
  ],
  suggestions: [
    {
      target: {
        type: "moduleContent",
        moduleId: "模块 ID",
        field: "content",
      },
      section: "skills",
      title: "专业技能候选内容",
      before: "必须等于目标模块当前完整文本，可以为空字符串",
      after: "可直接写入该模块的候选内容",
      reason: "说明内容来源于 JD 或用户补充信息，信息不足时写明需要用户补充",
    },
  ],
}

const ACTION_PROMPT_BUILDERS: Readonly<Record<AiResumeAction, PromptBuilder>> = {
  analyze: buildAnalyzePrompt,
  optimize: buildDefaultPrompt,
  generate: buildGeneratePrompt,
  proofread: buildDefaultPrompt,
}

type PromptBuilder = (request: AiResumeRequest, summary: ResumeSummary) => readonly AiMessage[]

interface GeneratedSectionTarget {
  readonly section: AiResumeSection
  readonly title: string
  readonly moduleId: string
  readonly currentContent: string
}

export function buildResumePrompt(request: AiResumeRequest, summary: ResumeSummary): readonly AiMessage[] {
  return ACTION_PROMPT_BUILDERS[request.action](request, summary)
}

function buildDefaultPrompt(request: AiResumeRequest, summary: ResumeSummary): readonly AiMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(request, summary) },
  ]
}

function buildAnalyzePrompt(request: AiResumeRequest, summary: ResumeSummary): readonly AiMessage[] {
  return [
    { role: "system", content: ANALYZE_MATCH_PROMPT },
    { role: "user", content: buildAnalyzeUserPrompt(request, summary) },
  ]
}

function buildGeneratePrompt(request: AiResumeRequest, summary: ResumeSummary): readonly AiMessage[] {
  return [
    { role: "system", content: GENERATE_CANDIDATE_PROMPT },
    { role: "user", content: buildGenerateUserPrompt(request, summary) },
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

// 此处填写分析匹配度提示词
const ANALYZE_MATCH_PROMPT = `你是专业中文简历岗位匹配度分析助手。
你必须基于用户提供的简历摘要和 JD 做匹配度分析。
不得编造简历中不存在的公司、学历、项目、指标、职责或成果。
matchScore 必须是 0 到 100 的整数，表示当前简历与 JD 的匹配度。
matchedKeywords 必须列出简历中已有证据支撑的匹配点。
missingKeywords 必须列出 JD 要求中当前简历未体现、证据不足或表达薄弱的点。
suggestions 只输出“不匹配内容优化建议”，每条建议必须指向输入摘要中真实存在的可写回 ID。
建议的 after 只能基于当前简历、JD 和用户补充信息改写；信息不足时必须在 reason 中写明“需要用户补充”。
输出必须是严格 JSON，不要输出 Markdown、代码块或解释文本。`

// 此处填写生成候选内容提示词
const GENERATE_CANDIDATE_PROMPT = `你是专业中文简历候选内容生成助手。
你必须基于目标岗位名称、JD、当前简历模块和用户补充信息生成候选内容。
不得编造用户未提供的公司、学历、项目、职责、指标或成果。
必须分别生成专业技能、工作经历、项目经历、职业技能四个模块的候选内容。
每个候选内容都必须通过 suggestions 返回，并使用 target.type = "moduleContent" 指向对应 moduleId。
before 必须逐字等于目标模块当前完整文本；空模块使用空字符串。
generatedSections 必须同步返回四个模块对应的候选内容，便于前端在 AI 分析结果中展示。
如果某个模块信息不足，after 中写“需要用户补充：...”并在 reason 中说明缺少的信息。
输出必须是严格 JSON，不要输出 Markdown、代码块或解释文本。`

function buildAnalyzeUserPrompt(request: AiResumeRequest, summary: ResumeSummary): string {
  return [
    `目标岗位：${request.targetRole || summary.targetRole || "未填写"}`,
    "Job Description：",
    request.jobDescription,
    "用户补充信息：",
    request.extraInfo || "无",
    "当前简历摘要（含可写回 ID）：",
    JSON.stringify(summary, null, 2),
    "返回 JSON schema：",
    JSON.stringify(ANALYZE_RESPONSE_SCHEMA, null, 2),
  ].join("\n\n")
}

function buildGenerateUserPrompt(request: AiResumeRequest, summary: ResumeSummary): string {
  return [
    `目标岗位：${request.targetRole || summary.targetRole}`,
    "Job Description：",
    request.jobDescription,
    "用户补充信息：",
    request.extraInfo,
    "目标写回模块：",
    JSON.stringify(buildGeneratedSectionTargets(summary), null, 2),
    "当前简历摘要（含可写回 ID）：",
    JSON.stringify(summary, null, 2),
    "返回 JSON schema：",
    JSON.stringify(GENERATE_RESPONSE_SCHEMA, null, 2),
  ].join("\n\n")
}

function buildGeneratedSectionTargets(summary: ResumeSummary): readonly GeneratedSectionTarget[] {
  return REQUIRED_AI_RESUME_MODULES.map((requirement) => {
    const module = findModuleByRequirement(summary.modules, requirement)
    if (!module) throw new Error(`请先创建${requirement.label}模块`)
    return {
      section: requirement.section,
      title: requirement.label,
      moduleId: module.moduleId,
      currentContent: readSummaryModuleText(module),
    }
  })
}

function readSummaryModuleText(module: ResumeModuleSummary): string {
  return module.rows
    .map((row) => {
      if (row.type === "tags") return (row.tags ?? []).join("、")
      return (row.elements ?? []).map((element) => element.text).join("\n")
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
