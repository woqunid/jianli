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

export type ModuleAiChange =
  | {
      readonly type: "replaceText"
      readonly rowId: string
      readonly elementId: string
      readonly before: string
      readonly after: string
    }
  | {
      readonly type: "replaceTags"
      readonly rowId: string
      readonly tags: readonly string[]
    }
  | {
      readonly type: "replaceRow"
      readonly rowId: string
      readonly row: ModuleAiRowDraft
    }
  | {
      readonly type: "insertRow"
      readonly afterRowId?: string
      readonly row: ModuleAiRowDraft
    }
  | {
      readonly type: "deleteRow"
      readonly rowId: string
    }

export interface ModuleAiRequest {
  readonly module: ResumeModule
  readonly messages: readonly ModuleAiMessage[]
}

export interface ModuleAiResponse {
  readonly reply: string
  readonly changes: readonly ModuleAiChange[]
}
