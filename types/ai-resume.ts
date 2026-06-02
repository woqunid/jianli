import type { ResumeData } from "@/types/resume"

export const AI_RESUME_ACTIONS = ["analyze", "optimize", "generate", "proofread"] as const

export const AI_RESUME_SECTIONS = [
  "jobIntention",
  "skills",
  "experience",
  "projects",
  "careerSkills",
  "summary",
  "proofread",
  "jdAnalysis",
] as const

export type AiResumeAction = (typeof AI_RESUME_ACTIONS)[number]

export type AiResumeSection = (typeof AI_RESUME_SECTIONS)[number]

export interface AiResumeRequest {
  readonly action: AiResumeAction
  readonly jobDescription: string
  readonly targetRole: string
  readonly resumeData: ResumeData
  readonly extraInfo: string
  readonly sections: readonly AiResumeSection[]
}

export type AiResumeSuggestionTarget =
  | {
      readonly type: "jobIntentionItem"
      readonly itemId: string
      readonly field: "value"
    }
  | {
      readonly type: "moduleElement"
      readonly moduleId: string
      readonly rowId: string
      readonly elementId: string
      readonly field: "content"
    }
  | {
      readonly type: "moduleTags"
      readonly moduleId: string
      readonly rowId: string
      readonly field: "tags"
    }
  | {
      readonly type: "moduleContent"
      readonly moduleId: string
      readonly field: "content"
    }

export interface AiResumeSuggestion {
  readonly target: AiResumeSuggestionTarget
  readonly section: AiResumeSection
  readonly title: string
  readonly before: string
  readonly after: string
  readonly reason: string
}

export interface AiGeneratedSection {
  readonly section: AiResumeSection
  readonly title: string
  readonly content: string
}

export interface AiResumeResponse {
  readonly summary: string
  readonly matchScore?: number
  readonly matchedKeywords: readonly string[]
  readonly missingKeywords: readonly string[]
  readonly improvementDirections?: readonly string[]
  readonly generatedSections?: readonly AiGeneratedSection[]
  readonly suggestions: readonly AiResumeSuggestion[]
}
