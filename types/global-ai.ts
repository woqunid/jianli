import type { ModuleAiChange } from "@/types/module-ai"
import type { ResumeData } from "@/types/resume"

export type GlobalAiMessageRole = "user" | "assistant"

export interface GlobalAiMessage {
  readonly role: GlobalAiMessageRole
  readonly content: string
}

export interface GlobalAiModuleDraft {
  readonly moduleId: string
  readonly moduleName: string
  readonly changes: readonly ModuleAiChange[]
}

export interface GlobalAiRequest {
  readonly resumeData: ResumeData
  readonly messages: readonly GlobalAiMessage[]
}

export interface GlobalAiResponse {
  readonly reply: string
  readonly drafts: readonly GlobalAiModuleDraft[]
}
