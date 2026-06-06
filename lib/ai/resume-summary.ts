import type { JSONContent, JobIntentionItem, PersonalInfoItem, ResumeData, ResumeModule } from "@/types/resume"

export interface ResumeSummary {
  readonly title: string
  readonly targetRole: string
  readonly personalInfo: readonly ResumePersonalInfoSummary[]
  readonly jobIntentions: readonly ResumeIntentSummary[]
  readonly modules: readonly ResumeModuleSummary[]
}

export interface ResumePersonalInfoSummary {
  readonly itemId: string
  readonly label: string
  readonly content: string
  readonly type: string
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

export function summarizeResume(resumeData: ResumeData, targetRole: string): ResumeSummary {
  return {
    title: resumeData.title,
    targetRole: targetRole || findTargetRole(resumeData),
    personalInfo: readPersonalInfoItems(resumeData).map(summarizePersonalInfo),
    jobIntentions: readJobIntentionItems(resumeData).map(summarizeJobIntention),
    modules: readModules(resumeData).map(summarizeModule),
  }
}

export function readSummaryPlainText(summary: ResumeSummary): string {
  const sections = [
    summary.targetRole,
    summary.personalInfo.map((item) => `${item.label}：${item.content}`).join("\n"),
    summary.jobIntentions.map((item) => `${item.label}：${item.value}`).join("\n"),
    summary.modules.map(readModuleText).join("\n"),
  ]
  return sections.filter(hasText).join("\n").trim()
}

function summarizePersonalInfo(item: PersonalInfoItem): ResumePersonalInfoSummary {
  return {
    itemId: item.id,
    label: item.label,
    content: item.value.content,
    type: item.value.type ?? "text",
  }
}

function summarizeJobIntention(item: JobIntentionItem): ResumeIntentSummary {
  return {
    itemId: item.id,
    label: item.label,
    type: item.type,
    value: item.value,
  }
}

function summarizeModule(module: ResumeModule): ResumeModuleSummary {
  return {
    moduleId: module.id,
    title: module.title,
    rows: readRows(module).map((row) => summarizeRow(module.id, row)),
  }
}

function summarizeRow(moduleId: string, row: ResumeModule["rows"][number]): ResumeRowSummary {
  if (row.type === "tags") {
    return { rowId: row.id, type: "tags", tags: row.tags ?? [] }
  }
  const elements = readElements(moduleId, row)
  return {
    rowId: row.id,
    type: "rich",
    elements: elements.map((element) => ({
      elementId: element.id,
      text: readJsonContentText(element.content),
    })),
  }
}

function readPersonalInfoItems(resumeData: ResumeData): readonly PersonalInfoItem[] {
  const items = resumeData.personalInfoSection?.personalInfo
  if (!Array.isArray(items)) throw new Error("个人信息必须是数组")
  return items
}

function readJobIntentionItems(resumeData: ResumeData): readonly JobIntentionItem[] {
  const section = resumeData.jobIntentionSection
  if (!section) return []
  if (!Array.isArray(section.items)) throw new Error("求职意向必须是数组")
  return section.items
}

function readModules(resumeData: ResumeData): readonly ResumeModule[] {
  if (!Array.isArray(resumeData.modules)) throw new Error("简历模块必须是数组")
  return resumeData.modules
}

function readRows(module: ResumeModule): ResumeModule["rows"] {
  if (!Array.isArray(module.rows)) throw new Error(`模块「${module.title || module.id}」的内容行必须是数组`)
  return module.rows
}

function readElements(moduleId: string, row: ResumeModule["rows"][number]) {
  if (!Array.isArray(row.elements)) throw new Error(`模块 ${moduleId} 的内容元素必须是数组`)
  return row.elements
}

function readModuleText(module: ResumeModuleSummary): string {
  const rows = module.rows.map((row) => {
    if (row.type === "tags") return (row.tags ?? []).join("、")
    return (row.elements ?? []).map((element) => element.text).join("\n")
  })
  return `${module.title}\n${rows.join("\n")}`.trim()
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

function findTargetRole(resumeData: ResumeData): string {
  const items = resumeData.jobIntentionSection?.items ?? []
  return items.find((item) => item.type === "position")?.value ?? ""
}

function hasText(value: string): boolean {
  return Boolean(value.trim())
}
