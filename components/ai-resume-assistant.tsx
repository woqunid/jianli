"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useToast } from "@/hooks/use-toast"
import { applyAiResumeSuggestion } from "@/lib/ai/resume-apply"
import { collectAiResumeInputErrors } from "@/lib/ai/resume-requirements"
import { requestJson } from "@/lib/fetch-json"
import type { AiResumeAction, AiResumeResponse, AiResumeSection, AiResumeSuggestion } from "@/types/ai-resume"
import type { ResumeData } from "@/types/resume"
import { Icon } from "@iconify/react"
import AiJdDialog from "./ai-jd-dialog"
import AiSuggestionPanel from "./ai-suggestion-panel"

interface AiResumeAssistantProps {
  readonly resumeData: ResumeData
  readonly onApplyResumeData: (resumeData: ResumeData) => void
}

const DEFAULT_SECTIONS: readonly AiResumeSection[] = ["jdAnalysis", "projects", "skills", "proofread"]
const EMPTY_RESULTS: Readonly<Record<AiResumeAction, AiResumeResponse | null>> = {
  analyze: null,
  optimize: null,
  generate: null,
  proofread: null,
}

export default function AiResumeAssistant({ resumeData, onApplyResumeData }: AiResumeAssistantProps) {
  const { toast } = useToast()
  const defaultRole = useMemo(() => findTargetRole(resumeData), [resumeData])
  const [action, setAction] = useState<AiResumeAction>("optimize")
  const [extraInfo, setExtraInfo] = useState("")
  const [jobDescription, setJobDescription] = useState("")
  const [results, setResults] = useState(EMPTY_RESULTS)
  const [sections, setSections] = useState(DEFAULT_SECTIONS)
  const [targetRole, setTargetRole] = useState(defaultRole)
  const [loadingActions, setLoadingActions] = useState<ReadonlySet<AiResumeAction>>(new Set())
  const [isOpen, setIsOpen] = useState(false)
  const activeResult = results[action]
  const isLoading = loadingActions.has(action)

  const submit = async () => {
    const currentAction = action
    if (loadingActions.has(currentAction)) return
    const role = targetRole.trim() || findTargetRole(resumeData)
    const jd = jobDescription.trim()
    const errors = collectAiResumeInputErrors({ action: currentAction, extraInfo, jobDescription: jd, resumeData, targetRole: role })
    if (errors.length > 0) {
      toast({ title: "无法生成 AI 建议", description: errors.join("；"), variant: "destructive" })
      return
    }
    if (sections.length === 0) {
      toast({ title: "无法生成 AI 建议", description: "请至少选择一个优化范围", variant: "destructive" })
      return
    }
    setLoadingActions((prev) => new Set(prev).add(currentAction))
    try {
      const response = await requestAiResume({
        action: currentAction,
        extraInfo,
        jobDescription: jd,
        resumeData,
        sections,
        targetRole: role,
      })
      setResults((prev) => ({ ...prev, [currentAction]: response }))
      toast({ title: readSuccessTitle(currentAction), description: readSuccessDescription(currentAction, response) })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast({ title: "AI 优化失败", description: message, variant: "destructive" })
    } finally {
      setLoadingActions((prev) => {
        const next = new Set(prev)
        next.delete(currentAction)
        return next
      })
    }
  }

  const updateOpen = (open: boolean) => {
    setIsOpen(open)
    if (open) setTargetRole(findTargetRole(resumeData))
  }

  const apply = (suggestion: AiResumeSuggestion) => {
    try {
      onApplyResumeData(applyAiResumeSuggestion(resumeData, suggestion))
      toast({ title: "已应用建议", description: suggestion.title })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast({ title: "应用失败", description: message, variant: "destructive" })
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={updateOpen}>
      <SheetTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="relative justify-center gap-2 px-3 py-1.5 text-foreground hover:bg-primary/10 hover:text-primary"
        >
          <Icon icon="mdi:sparkles" className="h-4 w-4" />
          <span className="hidden sm:inline">AI 优化</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle>AI 简历优化助手</SheetTitle>
          <SheetDescription>根据目标岗位 JD 生成候选建议，确认后再写回简历。</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-4 pb-6">
          <AiJdDialog
            action={action}
            extraInfo={extraInfo}
            jobDescription={jobDescription}
            sections={sections}
            targetRole={targetRole}
            onActionChange={setAction}
            onExtraInfoChange={setExtraInfo}
            onJobDescriptionChange={setJobDescription}
            onSectionsChange={setSections}
            onTargetRoleChange={setTargetRole}
          />
          <Button onClick={submit} disabled={isLoading} className="w-full gap-2">
            <Icon
              icon={isLoading ? "mdi:loading" : "mdi:sparkles"}
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            {isLoading ? "生成中" : readSubmitLabel(action)}
          </Button>
          <AiSuggestionPanel
            action={action}
            result={activeResult}
            isLoading={isLoading}
            onApply={apply}
            onRegenerate={submit}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

async function requestAiResume(input: {
  readonly action: AiResumeAction
  readonly extraInfo: string
  readonly jobDescription: string
  readonly resumeData: ResumeData
  readonly sections: readonly AiResumeSection[]
  readonly targetRole: string
}): Promise<AiResumeResponse> {
  return requestJson<AiResumeResponse>("/api/ai/resume", input)
}

function findTargetRole(resumeData: ResumeData): string {
  const items = resumeData.jobIntentionSection?.items ?? []
  return items.find((item) => item.type === "position")?.value ?? ""
}

function readSubmitLabel(action: AiResumeAction): string {
  if (action === "analyze") return "分析匹配度"
  if (action === "generate") return "生成候选内容"
  return "生成 AI 建议"
}

function readSuccessTitle(action: AiResumeAction): string {
  return action === "analyze" ? "匹配度分析完成" : "AI 优化完成"
}

function readSuccessDescription(action: AiResumeAction, response: AiResumeResponse): string {
  if (action === "analyze") {
    return response.matchScore === undefined ? "已生成分析结果" : `匹配度 ${response.matchScore}%`
  }
  return `生成 ${response.suggestions.length} 条建议`
}
