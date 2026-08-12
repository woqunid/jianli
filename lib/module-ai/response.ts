import type { ModuleAiChange, ModuleAiResponse, ModuleAiRowDraft } from "@/types/module-ai"

const MAX_COLUMNS = 4
const MIN_COLUMNS = 1

export function parseModuleAiResponseText(text: string): ModuleAiResponse {
  const parsed = parseJsonObject(text)
  return {
    reply: readString(parsed.reply, "reply"),
    changes: readChanges(parsed.changes, "changes"),
  }
}

export function readChanges(value: unknown, path: string): readonly ModuleAiChange[] {
  if (!Array.isArray(value)) throw new Error(`${path} 必须是数组`)
  return value.map((change, index) => readChange(change, `${path}[${index}]`))
}

function readChange(value: unknown, path: string): ModuleAiChange {
  const change = readRecord(value, path)
  const type = readString(change.type, `${path}.type`)

  if (type === "replaceText") {
    return {
      type,
      rowId: readString(change.rowId, `${path}.rowId`),
      elementId: readString(change.elementId, `${path}.elementId`),
      before: readNonEmptyText(change.before, `${path}.before`),
      after: readText(change.after, `${path}.after`),
    }
  }
  if (type === "replaceTags") {
    return {
      type,
      rowId: readString(change.rowId, `${path}.rowId`),
      tags: readStringArray(change.tags, `${path}.tags`),
    }
  }
  if (type === "replaceRow") {
    return {
      type,
      rowId: readString(change.rowId, `${path}.rowId`),
      row: readRow(change.row, `${path}.row`),
    }
  }
  if (type === "insertRow") {
    return {
      type,
      afterRowId: readOptionalString(change.afterRowId, `${path}.afterRowId`),
      row: readRow(change.row, `${path}.row`),
    }
  }
  if (type === "deleteRow") {
    return { type, rowId: readString(change.rowId, `${path}.rowId`) }
  }
  throw new Error(`不支持的 AI 修改类型：${type}`)
}

function readRow(value: unknown, path: string): ModuleAiRowDraft {
  const row = readRecord(value, path)
  const type = readString(row.type, `${path}.type`)
  if (type === "rich") return { type, columns: readColumns(row.columns, `${path}.columns`) }
  if (type === "tags") return { type, tags: readStringArray(row.tags, `${path}.tags`) }
  throw new Error(`不支持的 AI 行类型：${type}`)
}

function readColumns(value: unknown, path: string): readonly string[] {
  const columns = readStringArray(value, path)
  if (columns.length < MIN_COLUMNS || columns.length > MAX_COLUMNS) {
    throw new Error(`AI 富文本行必须包含 ${MIN_COLUMNS}-${MAX_COLUMNS} 列`)
  }
  return columns
}

function readStringArray(value: unknown, path: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${path} 必须是字符串数组`)
  return value.map((item, index) => readString(item, `${path}[${index}]`))
}

function parseJsonObject(text: string): Record<string, unknown> {
  if (!text.trim()) throw new Error("AI 服务没有返回内容")
  return readRecord(JSON.parse(text) as unknown, "AI 服务响应")
}

function readRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} 必须是 JSON 对象`)
  }
  return value as Record<string, unknown>
}

function readString(value: unknown, path: string): string {
  const text = readText(value, path).trim()
  if (!text) throw new Error(`${path} 必须是非空字符串`)
  return text
}

function readNonEmptyText(value: unknown, path: string): string {
  const text = readText(value, path)
  if (!text) throw new Error(`${path} 必须是非空字符串`)
  return text
}

function readOptionalString(value: unknown, path: string): string | undefined {
  if (typeof value === "undefined" || value === null || value === "") return undefined
  return readString(value, path)
}

function readText(value: unknown, path: string): string {
  if (typeof value !== "string") throw new Error(`${path} 必须是字符串`)
  return value
}
