import { readChanges } from "@/lib/module-ai/response"
import type { GlobalAiModuleDraft, GlobalAiResponse } from "@/types/global-ai"

export function parseGlobalAiResponseText(text: string): GlobalAiResponse {
  const parsed = parseJsonObject(text)
  return {
    reply: readString(parsed.reply, "reply"),
    drafts: readDrafts(parsed.drafts),
  }
}

function readDrafts(value: unknown): readonly GlobalAiModuleDraft[] {
  if (!Array.isArray(value)) throw new Error("AI 服务响应必须包含 drafts 数组")
  return value.map(readDraft)
}

function readDraft(value: unknown, index: number): GlobalAiModuleDraft {
  const path = `drafts[${index}]`
  const draft = readRecord(value, path)
  return {
    moduleId: readString(draft.moduleId, `${path}.moduleId`),
    moduleName: readString(draft.moduleName, `${path}.moduleName`),
    changes: readChanges(draft.changes, `${path}.changes`),
  }
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
  if (typeof value !== "string" || !value.trim()) throw new Error(`${path} 必须是非空字符串`)
  return value.trim()
}
