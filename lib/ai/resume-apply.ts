import type { AiResumeSuggestion, AiResumeSuggestionTarget } from "@/types/ai-resume"
import type { JSONContent, ModuleContentElement, ModuleContentRow, ResumeData } from "@/types/resume"

const TAG_SPLIT_PATTERN = /[\n,，;；、]+/
const SINGLE_COLUMN = 1
const FIRST_COLUMN_INDEX = 0
const FIRST_ROW_ORDER = 0
const RANDOM_ID_RADIX = 36
const ID_RANDOM_START = 2
const ID_RANDOM_END = 11

export function applyAiResumeSuggestion(resumeData: ResumeData, suggestion: AiResumeSuggestion): ResumeData {
  const currentValue = readTargetValue(resumeData, suggestion.target)
  if (currentValue !== suggestion.before) {
    throw new Error("当前内容已变化，请手动确认后再应用")
  }
  return applyTargetValue(resumeData, suggestion.target, suggestion.after)
}

export function readTargetValue(resumeData: ResumeData, target: AiResumeSuggestionTarget): string {
  if (target.type === "jobIntentionItem") {
    return readJobIntentionValue(resumeData, target.itemId)
  }
  if (target.type === "moduleTags") {
    return readTagsValue(resumeData, target.moduleId, target.rowId)
  }
  if (target.type === "moduleContent") {
    return readModuleValue(resumeData, target.moduleId)
  }
  return readElementValue(resumeData, target.moduleId, target.rowId, target.elementId)
}

function applyTargetValue(resumeData: ResumeData, target: AiResumeSuggestionTarget, value: string): ResumeData {
  if (target.type === "jobIntentionItem") {
    return applyJobIntentionValue(resumeData, target.itemId, value)
  }
  if (target.type === "moduleTags") {
    return applyTagsValue(resumeData, target.moduleId, target.rowId, value)
  }
  if (target.type === "moduleContent") {
    return applyModuleValue(resumeData, target.moduleId, value)
  }
  return applyElementValue(resumeData, target.moduleId, target.rowId, target.elementId, value)
}

function readJobIntentionValue(resumeData: ResumeData, itemId: string): string {
  const item = resumeData.jobIntentionSection?.items.find((entry) => entry.id === itemId)
  if (!item) throw new Error(`未找到求职意向项：${itemId}`)
  return item.value
}

function readTagsValue(resumeData: ResumeData, moduleId: string, rowId: string): string {
  const row = findRow(resumeData, moduleId, rowId)
  return (row.tags ?? []).join("、")
}

function readElementValue(resumeData: ResumeData, moduleId: string, rowId: string, elementId: string): string {
  const element = findElement(findRow(resumeData, moduleId, rowId), elementId)
  return readJsonContentText(element.content)
}

function readModuleValue(resumeData: ResumeData, moduleId: string): string {
  return findModule(resumeData, moduleId).rows
    .map((row) => {
      if (row.type === "tags") return (row.tags ?? []).join("、")
      return row.elements.map((element) => readJsonContentText(element.content)).join("\n")
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function applyJobIntentionValue(resumeData: ResumeData, itemId: string, value: string): ResumeData {
  const section = resumeData.jobIntentionSection
  if (!section) throw new Error("简历没有求职意向模块")
  return {
    ...resumeData,
    jobIntentionSection: {
      ...section,
      items: section.items.map((item) => (item.id === itemId ? { ...item, value } : item)),
    },
  }
}

function applyTagsValue(resumeData: ResumeData, moduleId: string, rowId: string, value: string): ResumeData {
  return updateRows(resumeData, moduleId, (row) => {
    if (row.id !== rowId) return row
    return { ...row, tags: value.split(TAG_SPLIT_PATTERN).map((tag) => tag.trim()).filter(Boolean) }
  })
}

function applyElementValue(resumeData: ResumeData, moduleId: string, rowId: string, elementId: string, value: string) {
  return updateRows(resumeData, moduleId, (row) => {
    if (row.id !== rowId) return row
    const elements = row.elements.map((element) => updateElement(element, elementId, value))
    return { ...row, elements }
  })
}

function applyModuleValue(resumeData: ResumeData, moduleId: string, value: string): ResumeData {
  return {
    ...resumeData,
    modules: resumeData.modules.map((module) => {
      if (module.id !== moduleId) return module
      return { ...module, rows: [createSingleContentRow(value)] }
    }),
  }
}

function updateRows(resumeData: ResumeData, moduleId: string, update: (row: ModuleContentRow) => ModuleContentRow) {
  return {
    ...resumeData,
    modules: resumeData.modules.map((module) => {
      if (module.id !== moduleId) return module
      return { ...module, rows: module.rows.map(update) }
    }),
  }
}

function updateElement(element: ModuleContentElement, elementId: string, value: string): ModuleContentElement {
  if (element.id !== elementId) return element
  return { ...element, content: createTextContent(value) }
}

function findRow(resumeData: ResumeData, moduleId: string, rowId: string): ModuleContentRow {
  const module = findModule(resumeData, moduleId)
  const row = module.rows.find((entry) => entry.id === rowId)
  if (!row) throw new Error(`未找到内容行：${rowId}`)
  return row
}

function findModule(resumeData: ResumeData, moduleId: string) {
  const module = resumeData.modules.find((entry) => entry.id === moduleId)
  if (!module) throw new Error(`未找到模块：${moduleId}`)
  return module
}

function findElement(row: ModuleContentRow, elementId: string): ModuleContentElement {
  const element = row.elements.find((entry) => entry.id === elementId)
  if (!element) throw new Error(`未找到内容元素：${elementId}`)
  return element
}

function createTextContent(value: string): JSONContent {
  return {
    type: "doc",
    content: value.split(/\r?\n/).map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  }
}

function createSingleContentRow(value: string): ModuleContentRow {
  return {
    id: createId("ai-row"),
    type: "rich",
    columns: SINGLE_COLUMN,
    elements: [
      {
        id: createId("ai-elem"),
        content: createTextContent(value),
        columnIndex: FIRST_COLUMN_INDEX,
      },
    ],
    order: FIRST_ROW_ORDER,
  }
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(RANDOM_ID_RADIX).slice(ID_RANDOM_START, ID_RANDOM_END)}`
}

function readJsonContentText(content: JSONContent): string {
  const parts: string[] = []
  collectText(content, parts)
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim()
}

function collectText(node: JSONContent, parts: string[]): void {
  if (node.type === "paragraph" && parts.length > 0) parts.push("\n")
  if (node.text) parts.push(node.text)
  node.content?.forEach((child) => collectText(child, parts))
}
