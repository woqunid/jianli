import type { ModuleAiResponse, ModuleAiRowDraft } from "@/types/module-ai"

const MAX_COLUMNS = 4
const MIN_COLUMNS = 1

export function parseModuleAiResponseText(text: string): ModuleAiResponse {
  const parsed = parseJsonObject(text)
  return {
    reply: readString(parsed.reply, "reply"),
    rows: readRows(parsed.rows),
  }
}

function parseJsonObject(text: string): Record<string, unknown> {
  if (!text.trim()) {
    throw new Error("AI 服务没有返回内容")
  }
  const value = JSON.parse(text) as unknown
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI 服务响应必须是 JSON 对象")
  }
  return value as Record<string, unknown>
}

function readRows(value: unknown): readonly ModuleAiRowDraft[] {
  if (!Array.isArray(value)) {
    throw new Error("AI 服务响应必须包含 rows 数组")
  }
  return value.map(readRow)
}

function readRow(value: unknown): ModuleAiRowDraft {
  const row = readRecord(value, "rows[]")
  const type = readString(row.type, "row.type")
  if (type === "rich") {
    return { type, columns: readColumns(row.columns) }
  }
  if (type === "tags") {
    return { type, tags: readStringArray(row.tags, "row.tags") }
  }
  throw new Error(`不支持的 AI 行类型：${type}`)
}

function readColumns(value: unknown): readonly string[] {
  const columns = readStringArray(value, "row.columns")
  if (columns.length < MIN_COLUMNS || columns.length > MAX_COLUMNS) {
    throw new Error(`AI 富文本行必须包含 ${MIN_COLUMNS}-${MAX_COLUMNS} 列`)
  }
  return columns
}

function readStringArray(value: unknown, path: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} 必须是字符串数组`)
  }
  return value.map((item, index) => readString(item, `${path}[${index}]`))
}

function readRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} 必须是 JSON 对象`)
  }
  return value as Record<string, unknown>
}

function readString(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${path} 必须是非空字符串`)
  }
  return value.trim()
}
