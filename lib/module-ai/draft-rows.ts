import type { ModuleAiRowDraft } from "@/types/module-ai"
import type { JSONContent, ModuleContentElement, ModuleContentRow } from "@/types/resume"

const ID_RANDOM_END = 11
const ID_RANDOM_START = 2
const MAX_COLUMNS = 4
const MIN_COLUMNS = 1
const RANDOM_ID_RADIX = 36

export function createModuleRowsFromDrafts(rows: readonly ModuleAiRowDraft[]): ModuleContentRow[] {
  if (rows.length === 0) {
    throw new Error("AI 回复没有可应用的模块内容")
  }
  return rows.map(createModuleRow)
}

function createModuleRow(row: ModuleAiRowDraft, order: number): ModuleContentRow {
  if (row.type === "tags") {
    return createTagsRow(row.tags, order)
  }
  return createRichRow(row.columns, order)
}

function createRichRow(columns: readonly string[], order: number): ModuleContentRow {
  validateColumns(columns)
  return {
    id: createId("ai-row"),
    type: "rich",
    columns: columns.length as ModuleContentRow["columns"],
    elements: columns.map(createElement),
    order,
  }
}

function createTagsRow(tags: readonly string[], order: number): ModuleContentRow {
  return {
    id: createId("ai-tags"),
    type: "tags",
    columns: MIN_COLUMNS,
    elements: [],
    tags: tags.map((tag) => tag.trim()).filter(Boolean),
    order,
  }
}

function createElement(text: string, columnIndex: number): ModuleContentElement {
  return {
    id: createId("ai-elem"),
    content: createTextContent(text),
    columnIndex,
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

function validateColumns(columns: readonly string[]): void {
  if (columns.length < MIN_COLUMNS || columns.length > MAX_COLUMNS) {
    throw new Error(`富文本行必须包含 ${MIN_COLUMNS}-${MAX_COLUMNS} 列`)
  }
}

function createId(prefix: string): string {
  const randomPart = Math.random().toString(RANDOM_ID_RADIX).slice(ID_RANDOM_START, ID_RANDOM_END)
  return `${prefix}-${Date.now()}-${randomPart}`
}
