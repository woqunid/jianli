import type { AiResumeAction, AiResumeSection } from "@/types/ai-resume"
import type { JSONContent, ResumeData, ResumeModule } from "@/types/resume"

interface AiResumeInput {
  readonly action: AiResumeAction
  readonly jobDescription: string
  readonly targetRole: string
  readonly resumeData: ResumeData
  readonly extraInfo: string
}

export interface RequiredResumeModule {
  readonly section: AiResumeSection
  readonly label: string
  readonly aliases: readonly string[]
}

const MIN_REAL_CONTENT_LENGTH = 6
const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /\bXX\b/i,
  /\bxxx+\b/i,
  /待填写|请输入|示例内容/,
  /X秒|X分钟|X%|X人|X个/,
]

export const REQUIRED_AI_RESUME_MODULES: readonly RequiredResumeModule[] = [
  { section: "skills", label: "专业技能", aliases: ["专业技能"] },
  { section: "experience", label: "工作经历", aliases: ["工作经历", "工作经验"] },
  { section: "projects", label: "项目经历", aliases: ["项目经历", "项目经验"] },
  { section: "careerSkills", label: "职业技能", aliases: ["职业技能"] },
]

export function collectAiResumeInputErrors(input: AiResumeInput): readonly string[] {
  if (input.action === "generate") {
    return collectGenerateErrors(input)
  }
  if (input.action === "analyze") {
    return collectAnalyzeErrors(input)
  }
  return input.jobDescription.trim() ? [] : ["请先粘贴目标岗位 JD"]
}

export function validateAiResumeInput(input: AiResumeInput): void {
  const errors = collectAiResumeInputErrors(input)
  if (errors.length > 0) {
    throw new Error(errors.join("；"))
  }
}

export function findModuleByRequirement<T extends Pick<ResumeModule, "title">>(
  modules: readonly T[],
  requirement: RequiredResumeModule,
) {
  return modules.find((module) => matchesRequirement(module.title, requirement)) ?? null
}

export function readModulePlainText(module: ResumeModule): string {
  return module.rows
    .map((row) => {
      if (row.type === "tags") return (row.tags ?? []).join("、")
      return row.elements.map((element) => readJsonContentText(element.content)).join("\n")
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function collectGenerateErrors(input: AiResumeInput): readonly string[] {
  return [
    input.targetRole.trim() ? "" : "请填写目标岗位名称",
    input.jobDescription.trim() ? "" : "请先粘贴目标岗位 JD",
    input.extraInfo.trim() ? "" : "请填写用户补充信息",
    ...collectMissingModuleErrors(input.resumeData),
  ].filter(Boolean)
}

function collectAnalyzeErrors(input: AiResumeInput): readonly string[] {
  return [
    input.jobDescription.trim() ? "" : "请先粘贴目标岗位 JD",
    ...collectRequiredContentErrors(input.resumeData),
  ].filter(Boolean)
}

function collectMissingModuleErrors(resumeData: ResumeData): readonly string[] {
  return REQUIRED_AI_RESUME_MODULES.map((requirement) => {
    const module = findModuleByRequirement(resumeData.modules, requirement)
    return module ? "" : `请先创建${requirement.label}模块`
  }).filter(Boolean)
}

function collectRequiredContentErrors(resumeData: ResumeData): readonly string[] {
  return REQUIRED_AI_RESUME_MODULES.map((requirement) => {
    const module = findModuleByRequirement(resumeData.modules, requirement)
    if (!module) return `请先创建${requirement.label}模块`
    return hasRealContent(readModulePlainText(module)) ? "" : `${requirement.label}必须填写真实内容`
  }).filter(Boolean)
}

function matchesRequirement(title: string, requirement: RequiredResumeModule): boolean {
  const normalized = normalizeTitle(title)
  return requirement.aliases.some((alias) => normalized === normalizeTitle(alias))
}

function hasRealContent(text: string): boolean {
  const normalized = text.trim()
  if (normalized.length < MIN_REAL_CONTENT_LENGTH) return false
  return !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized))
}

function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, "").trim()
}

function readJsonContentText(content: JSONContent): string {
  return collectText(content).replace(/\n{3,}/g, "\n\n").trim()
}

function collectText(node: JSONContent): string {
  const prefix = node.type === "paragraph" ? "\n" : ""
  const ownText = node.text ?? ""
  const childText = node.content?.map(collectText).join("") ?? ""
  return `${prefix}${ownText}${childText}`
}
