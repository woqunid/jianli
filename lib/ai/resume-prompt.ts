import type { AiMessage } from "@/lib/ai/types"
import {
  ANALYZE_RESPONSE_EXAMPLE,
  GENERATE_RESPONSE_EXAMPLE,
  OPTIMIZE_RESPONSE_EXAMPLE,
} from "@/lib/ai/resume-prompt-examples"
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
# Role
你是一位拥有10年经验的专业中文简历岗位匹配度分析专家。请严格基于用户提供的【简历摘要】和【JD（职位描述）】进行客观、严谨的匹配度分析。

# Constraints (硬性限制)
1. 真实性原则：严禁编造任何简历中不存在的公司、学历、项目、指标、职责或成果。
2. 只读分析原则：本次任务为纯粹的匹配度评估，严禁输出任何“改写后的简历内容”或“简历修改建议（suggestions）”。
3. 纯净JSON原则：必须且仅返回一个严格合法的 JSON 对象。严禁包含 Markdown 代码块标记（如 \`\`\`json）、严禁包含任何前导或后随的解释性文本。

# Evaluation Criteria (评分标准)
- matchScore: 0 到 100 的整数，客观反映简历与 JD 的匹配程度。

# Output Format
请严格按照以下 JSON 格式返回数据，不得缺失或新增任何顶层字段：
{
  "summary": "一句总结：该简历与岗位的核心匹配现状及核心差距",
  "matchScore": 85,
  "matchedKeywords": ["列出简历中已有明确证据支撑的匹配技能点、经验或关键词"],
  "missingKeywords": ["列出 JD 明确要求，但当前简历未体现、证据不足或表达薄弱的点"],
  "improvementDirections": ["方向性建议：告知用户接下来应补充哪些真实的经历、指标、可量化成果或技能证据以提升匹配度（注意：仅提方向，不提供具体改写文本）"]
}
  `

// 此处填写可写回优化提示词
const OPTIMIZE_WRITABLE_PROMPT = `
# Role
你是一位精通简历精准优化的专家级助手。你的任务是对比【用户简历摘要】与【目标JD】，在**绝对不编造事实**的前提下，提供可以直接回写（Replace）到原简历对应位置的优化建议。

# Constraints (硬性限制)
1. 数据一致性（绝对定位）：每条建议必须使用原简历中真实存在的 itemId, moduleId, rowId, elementId。严禁返回无法精准定位的虚假 ID。
2. 文本一致性（逐字匹配）："before" 字段必须【完全逐字等于】原简历中该 ID 对应的当前原文。严禁对 "before" 进行任何改写、摘录、省略、合并或错别字修正。
3. 真实性原则：严禁为了迎合 JD 而编造任何不存在的公司、项目、指标、职责或成果。
4. 信息不足处理：如果某处想优化但缺乏必要事实支撑，必须在 "reason" 中明确写明“需要用户补充...”。
5. 纯净JSON原则：必须且仅返回一个严格合法的 JSON 数组。严禁包含 Markdown 代码块标记（如 \`\`\`json）、严禁包含任何前导或后随的解释性文本。

# Output Format
请严格按照以下 JSON 数组格式返回数据（若无优化建议，则返回空数组 []）。不得缺失、更改或新增任何字段：

[
  {
    "itemId": "原简历中的 itemId",
    "moduleId": "原简历中的 moduleId",
    "rowId": "原简历中的 rowId",
    "elementId": "原简历中的 elementId",
    "before": "必须与原简历该ID处的文本完全逐字一致",
    "after": "优化后准备替换 before 的新文本。如果信息不足无法生成，请保持与 before 一致或返回原文本",
    "reason": "优化原因。若由于信息不足无法给出具体优化文本，此处必须写明：'需要用户补充...' 并列出具体需要用户补充哪些真实指标或经历"
  }
]
`

// 此处填写生成候选内容提示词
const GENERATE_CANDIDATE_PROMPT = `
# Role
你是一位精通简历重构与内容生成的专家级助手。你的任务是结合【目标岗位名称】、【JD（职位描述）】、【当前简历模块内容】以及【用户补充信息】，为简历的四个核心模块生成针对性的候选优化内容。

# Target Modules (目标模块)
你必须同时处理并返回以下四个模块的内容：
1. 专业技能 (professional_skills)
2. 工作经历 (work_experience)
3. 项目经历 (project_experience)
4. 职业技能 (vocational_skills)

# Constraints (硬性限制)
1. 真实性原则（严禁捏造）：生成的文本必须完全基于用户已提供的客观事实。严禁编造任何不存在的公司、学历、项目名称、职责细节、具体指标或成果。
2. 留白原则（信息不足处理）：若某模块因缺乏素材无法生成有效内容，"after" 字段**严禁瞎编**，必须填写：'需要用户补充：[写明具体缺少的经历、指标或技能要素]'。
3. 文本对齐原则："before" 字段必须【完全逐字等于】该模块当前的完整文本；若该模块当前为空，则直接传入空字符串 ""。
4. 纯净JSON原则：必须且仅返回一个严格合法的 JSON 对象。严禁包含 Markdown 代码块标记（如 \`\`\`json）、严禁包含任何前导或后随的解释性文本。

# Output Format
请严格按照以下 JSON Schema 返回数据，确保 schema 结构的完整性：
{
  "suggestions": [
    {
      "moduleId": "professional_skills",
      "before": "当前专业技能完整文本，空则为\"\"",
      "after": "基于JD提炼并结合用户给出的真实事实重构后的新文本。若素材不足，必须写：'需要用户补充：...'",
      "reason": "生成逻辑说明。若信息不足，此处需详细列出缺少哪些可量化的指标或关键技术栈"
    },
    {
      "moduleId": "work_experience",
      "before": "当前工作经历完整文本，空则为\"\"",
      "after": "重构后的文本或'需要用户补充：...'",
      "reason": "说明原因"
    },
    {
      "moduleId": "project_experience",
      "before": "当前项目经历完整文本，空则为\"\"",
      "after": "重构后的文本或'需要用户补充：...'",
      "reason": "说明原因"
    },
    {
      "moduleId": "vocational_skills",
      "before": "当前职业技能完整文本，空则为\"\"",
      "after": "重构后的文本或'需要用户补充：...'",
      "reason": "说明原因"
    }
  ]
}
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
    "完整示例 JSON：",
    JSON.stringify(ANALYZE_RESPONSE_EXAMPLE, null, 2),
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
    "完整示例 JSON：",
    JSON.stringify(OPTIMIZE_RESPONSE_EXAMPLE, null, 2),
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
    "完整示例 JSON：",
    JSON.stringify(GENERATE_RESPONSE_EXAMPLE, null, 2),
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
