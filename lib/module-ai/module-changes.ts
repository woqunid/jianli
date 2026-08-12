import type { JSONContent, ModuleContentElement, ModuleContentRow, ResumeModule } from "@/types/resume"
import type { ModuleAiChange, ModuleAiRowDraft } from "@/types/module-ai"

const MAX_COLUMNS = 4
const MIN_COLUMNS = 1

export function applyModuleAiChanges(module: ResumeModule, changes: readonly ModuleAiChange[]): ResumeModule {
  if (changes.length === 0) throw new Error("AI 回复没有可应用的修改")

  let rows = module.rows.map(cloneRow)
  for (const change of changes) {
    rows = applyChange(rows, change)
  }

  return {
    ...module,
    rows: rows.map((row, order) => ({ ...row, order })),
  }
}

function applyChange(rows: ModuleContentRow[], change: ModuleAiChange): ModuleContentRow[] {
  if (change.type === "insertRow") return insertRow(rows, change.afterRowId, change.row)

  const rowIndex = rows.findIndex((row) => row.id === change.rowId)
  if (rowIndex < 0) throw new Error(`未找到目标行：${change.rowId}`)

  if (change.type === "deleteRow") return rows.filter((_, index) => index !== rowIndex)
  if (change.type === "replaceRow") {
    const current = rows[rowIndex]
    const replacement = createRow(change.row, current.order)
    rows[rowIndex] = { ...replacement, id: current.id }
    return rows
  }
  if (change.type === "replaceTags") {
    const current = rows[rowIndex]
    if (current.type !== "tags") throw new Error(`目标行不是标签行：${change.rowId}`)
    rows[rowIndex] = { ...current, tags: cleanTags(change.tags) }
    return rows
  }

  const current = rows[rowIndex]
  if (current.type === "tags") throw new Error(`标签行不包含富文本元素：${change.rowId}`)
  const elementIndex = current.elements.findIndex((element) => element.id === change.elementId)
  if (elementIndex < 0) throw new Error(`未找到目标元素：${change.elementId}`)
  const element = current.elements[elementIndex]
  const content = replaceTextPreservingFormat(element.content, change.before, change.after)
  const elements = [...current.elements]
  elements[elementIndex] = { ...element, content }
  rows[rowIndex] = { ...current, elements }
  return rows
}

function insertRow(rows: ModuleContentRow[], afterRowId: string | undefined, draft: ModuleAiRowDraft): ModuleContentRow[] {
  const insertIndex = afterRowId ? rows.findIndex((row) => row.id === afterRowId) + 1 : rows.length
  if (afterRowId && insertIndex === 0) throw new Error(`未找到插入位置：${afterRowId}`)
  const next = [...rows]
  next.splice(insertIndex, 0, createRow(draft, insertIndex))
  return next
}

function createRow(draft: ModuleAiRowDraft, order: number): ModuleContentRow {
  if (draft.type === "tags") {
    return {
      id: createId("ai-tags"),
      type: "tags",
      columns: 1,
      elements: [],
      tags: cleanTags(draft.tags),
      order,
    }
  }

  if (draft.columns.length < MIN_COLUMNS || draft.columns.length > MAX_COLUMNS) {
    throw new Error(`富文本行必须包含 ${MIN_COLUMNS}-${MAX_COLUMNS} 列`)
  }
  return {
    id: createId("ai-row"),
    type: "rich",
    columns: draft.columns.length as ModuleContentRow["columns"],
    elements: draft.columns.map(createElement),
    order,
  }
}

function createElement(text: string, columnIndex: number): ModuleContentElement {
  return {
    id: createId("ai-elem"),
    columnIndex,
    content: createTextContent(text),
  }
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

function replaceTextPreservingFormat(content: JSONContent, before: string, after: string): JSONContent {
  if (!before) throw new Error("替换原文不能为空")
  const direct = replaceInsideSingleTextNode(content, before, after)
  if (direct) return direct
  throw new Error("目标内容已经变化或跨越多个富文本样式，请重新让 AI 精确定位后再修改")
}

function replaceInsideSingleTextNode(node: JSONContent, before: string, after: string): JSONContent | null {
  if (typeof node.text === "string" && node.text.includes(before)) {
    return { ...node, text: node.text.replace(before, after) }
  }
  if (!node.content) return null
  for (let index = 0; index < node.content.length; index += 1) {
    const replacement = replaceInsideSingleTextNode(node.content[index], before, after)
    if (!replacement) continue
    const children = [...node.content]
    children[index] = replacement
    return { ...node, content: children }
  }
  return null
}

function cloneRow(row: ModuleContentRow): ModuleContentRow {
  return {
    ...row,
    elements: row.elements.map((element) => ({
      ...element,
      content: structuredClone(element.content),
    })),
    tags: row.tags ? [...row.tags] : undefined,
  }
}

function cleanTags(tags: readonly string[]): string[] {
  return tags.map((tag) => tag.trim()).filter(Boolean)
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}
