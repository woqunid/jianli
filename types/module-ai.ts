import type { ResumeModule } from "@/types/resume"

export type ModuleAiMessageRole = "user" | "assistant"

export interface ModuleAiMessage {
  readonly role: ModuleAiMessageRole
  readonly content: string
}

export interface ModuleAiRichRowDraft {
  readonly type: "rich"
  readonly columns: readonly string[]
}

export interface ModuleAiTagsRowDraft {
  readonly type: "tags"
  readonly tags: readonly string[]
}

export type ModuleAiRowDraft = ModuleAiRichRowDraft | ModuleAiTagsRowDraft

export interface ModuleAiRequest {
  readonly module: ResumeModule
  readonly messages: readonly ModuleAiMessage[]
}

export interface ModuleAiResponse {
  readonly reply: string
  readonly rows: readonly ModuleAiRowDraft[]
}
