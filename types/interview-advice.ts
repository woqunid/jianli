import type { ResumeData } from "@/types/resume"

export interface AiInterviewAdviceRequest {
  readonly resumeData: ResumeData
}

export interface AiInterviewAdviceResponse {
  readonly overview: string
  readonly workNature: string
  readonly adviceSections: readonly InterviewAdviceSection[]
  readonly selfIntroduction: InterviewSelfIntroduction
  readonly questions: readonly InterviewQuestion[]
}

export interface InterviewAdviceSection {
  readonly title: string
  readonly focus: string
  readonly items: readonly InterviewAdviceItem[]
}

export interface InterviewAdviceItem {
  readonly title: string
  readonly detail: string
  readonly actions: readonly string[]
}

export interface InterviewSelfIntroduction {
  readonly content: string
  readonly keyPoints: readonly string[]
}

export interface InterviewQuestion {
  readonly category: string
  readonly question: string
  readonly answer: string
  readonly resumeBasis: string
}
