import type { AiMessage } from "@/lib/ai/types"
import {
  ANALYZE_RESPONSE_EXAMPLE,
  GENERATE_RESPONSE_EXAMPLE,
  OPTIMIZE_RESPONSE_EXAMPLE,
} from "@/lib/ai/resume-prompt-examples"
import { findModuleByRequirement, REQUIRED_AI_RESUME_MODULES } from "@/lib/ai/resume-requirements"
import type { ResumeModuleSummary, ResumeSummary } from "@/lib/ai/resume-summary"
import type { AiResumeAction, AiResumeRequest, AiResumeSection } from "@/types/ai-resume"

const SYSTEM_PROMPT = `你是专业中文简历优化助手。
你必须基于用户提供的简历、JD 和补充信息进行优化。
不得编造公司、学历、项目、指标、职责或成果。
如果信息不足，必须在 reason 中标记“需要用户补充”，不能虚构。
你只能针对输入摘要里存在的 itemId、moduleId、rowId、elementId 返回建议。
输出必须是严格 JSON，不要输出 Markdown、代码块或解释文本。`

const EXAMPLE_MATCH_SCORE = 82

const OPTIMIZE_RESPONSE_SCHEMA = {
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
  improvementDirections: ["基于缺失点给出的只读改进方向，不要写成可直接覆盖简历的内容"],
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
  optimize: buildOptimizePrompt,
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

function buildOptimizePrompt(request: AiResumeRequest, summary: ResumeSummary): readonly AiMessage[] {
  return [
    { role: "system", content: OPTIMIZE_WRITABLE_PROMPT },
    { role: "user", content: buildOptimizeUserPrompt(request, summary) },
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
    JSON.stringify(OPTIMIZE_RESPONSE_SCHEMA, null, 2),
  ].join("\n\n")
}

// 此处填写分析匹配度提示词
const ANALYZE_MATCH_PROMPT = `
你是专业中文简历岗位匹配度分析助手。
你必须基于用户提供的简历摘要和 JD 做只读分析。
不得编造简历中不存在的公司、学历、项目、指标、职责或成果。
matchScore 必须是 0 到 100 的整数，表示当前简历与 JD 的匹配度。
matchedKeywords 必须列出简历中已有证据支撑的匹配点。
missingKeywords 必须列出 JD 要求中当前简历未体现、证据不足或表达薄弱的点。
improvementDirections 只能列出只读改进方向，不得提供可直接写回简历的改写文本。
必须且仅返回一个严格合法的 JSON 对象；第一个字符必须是 {，最后一个非空字符必须是 }。
顶层字段固定为：summary、matchScore、matchedKeywords、missingKeywords、improvementDirections。
不要返回 suggestions 字段，不要输出 Markdown、代码块、解释文本、标题或寒暄。`

// 此处填写可写回优化提示词
const OPTIMIZE_WRITABLE_PROMPT = `
你是专业中文简历可写回优化助手。
你必须基于用户提供的简历摘要、JD 和补充信息输出可写回建议。
不得编造公司、学历、项目、指标、职责或成果；信息不足时必须在 reason 中写明“需要用户补充”。
必须且仅返回一个严格合法的 JSON 对象；第一个字符必须是 {，最后一个非空字符必须是 }。
顶层字段固定为：summary、matchedKeywords、missingKeywords、suggestions。
suggestions 必须是数组；若无可写回建议，返回空数组。
每条 suggestion 必须包含 target、section、title、before、after、reason。
target 必须使用当前简历摘要里真实存在的 itemId、moduleId、rowId、elementId。
before 必须逐字等于 target 当前原文，禁止改写、摘录、省略、合并或标准化 before。
after 是准备写回 target 的替换内容；不能为了贴合 JD 编造项目、公司、职责或指标。
不要输出 JSON 数组作为顶层结果，不要输出 Markdown、代码块、解释文本、标题或寒暄。
`

// 此处填写生成候选内容提示词
const GENERATE_CANDIDATE_PROMPT = `
你是专业中文简历候选内容生成助手。
你必须基于目标岗位名称、JD 和用户补充信息生成候选内容；当前简历模块只作为写回容器，可为空。
专业技能必须从 JD 关键词和用户补充信息中提炼，不能凭空声称用户掌握未提供依据的能力。
工作经历和项目经历必须生成一份适合应对 Job Description 的模板草稿。
模板草稿可以使用岗位相关表达组织内容，但不得编造用户未提供的公司、学历、项目名称、职责、指标或成果。
用户未提供的事实必须写成【待补充：具体内容】格式，例如【待补充：公司名称】、【待补充：性能优化指标】。
除非 JD 和用户补充信息完全不足，否则不要返回空字符串；优先给出可编辑的草稿骨架。
必须分别生成专业技能、工作经历、项目经历三个模块的候选内容。
必须且仅返回一个严格合法的 JSON 对象；第一个字符必须是 {，最后一个非空字符必须是 }。
顶层字段固定为：summary、matchedKeywords、missingKeywords、generatedSections、suggestions。
generatedSections 必须同步返回三个模块对应的候选内容，便于前端展示。
每个候选内容都必须通过 suggestions 返回，并使用 target.type = "moduleContent" 指向目标写回模块的真实 moduleId。
before 必须逐字等于目标模块当前完整文本；空模块使用空字符串。
候选内容应能直接写入简历模块；待补充项必须保留醒目的【待补充：...】占位。
不要输出 JSON 数组作为顶层结果，不要输出 Markdown、代码块、解释文本、标题或寒暄。
`

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
    "结构示例 JSON（仅参考结构，实际内容必须基于本次简历和 JD）：",
    JSON.stringify(ANALYZE_RESPONSE_EXAMPLE, null, 2),
    "现在只返回本次分析的 JSON 对象，不要复述 schema 或示例。",
  ].join("\n\n")
}

function buildOptimizeUserPrompt(request: AiResumeRequest, summary: ResumeSummary): string {
  return [
    `目标岗位：${request.targetRole || summary.targetRole || "未填写"}`,
    `优化范围：${request.sections.join(", ")}`,
    "Job Description：",
    request.jobDescription,
    "用户补充信息：",
    request.extraInfo || "无",
    "当前简历摘要（含可写回 ID）：",
    JSON.stringify(summary, null, 2),
    "返回 JSON schema：",
    JSON.stringify(OPTIMIZE_RESPONSE_SCHEMA, null, 2),
    "结构示例 JSON（仅参考结构，实际返回必须使用本次简历摘要中的真实 ID 和原文）：",
    JSON.stringify(OPTIMIZE_RESPONSE_EXAMPLE, null, 2),
    "现在只返回本次优化建议的 JSON 对象，不要复述 schema 或示例。",
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
    "结构示例 JSON（仅参考结构，实际返回必须使用目标写回模块中的真实 moduleId 和 currentContent）：",
    JSON.stringify(GENERATE_RESPONSE_EXAMPLE, null, 2),
    "现在只返回本次候选内容的 JSON 对象，不要复述 schema 或示例。",
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
