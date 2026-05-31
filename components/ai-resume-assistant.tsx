"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useToast } from "@/hooks/use-toast"
import { applyAiResumeSuggestion } from "@/lib/ai/resume-apply"
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

export default function AiResumeAssistant({ resumeData, onApplyResumeData }: AiResumeAssistantProps) {
  const { toast } = useToast()
  const defaultRole = useMemo(() => findTargetRole(resumeData), [resumeData])
  const [action, setAction] = useState<AiResumeAction>("optimize")
  const [extraInfo, setExtraInfo] = useState("")
  const [jobDescription, setJobDescription] = useState("")
  const [result, setResult] = useState<AiResumeResponse | null>(null)
  const [sections, setSections] = useState(DEFAULT_SECTIONS)
  const [targetRole, setTargetRole] = useState(defaultRole)
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const submit = async () => {
    const role = targetRole.trim() || findTargetRole(resumeData)
    const jd = jobDescription.trim()
    if (!jd) {
      toast({ title: "无法生成 AI 建议", description: "请先粘贴目标岗位 JD", variant: "destructive" })
      return
    }
    if (sections.length === 0) {
      toast({ title: "无法生成 AI 建议", description: "请至少选择一个优化范围", variant: "destructive" })
      return
    }
    setIsLoading(true)
    try {
      const response = await requestAiResume({ action, extraInfo, jobDescription: jd, resumeData, sections, targetRole: role })
      setResult(response)
      toast({ title: "AI 优化完成", description: `生成 ${response.suggestions.length} 条建议` })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast({ title: "AI 优化失败", description: message, variant: "destructive" })
    } finally {
      setIsLoading(false)
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
          className="relative min-w-[100px] justify-center gap-2 px-3 py-1.5 text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          <Icon icon="mdi:creation" className="h-4 w-4" />
          AI 优化
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
            {isLoading ? "生成中" : "生成 AI 建议"}
          </Button>
          <AiSuggestionPanel result={result} isLoading={isLoading} onApply={apply} onRegenerate={submit} />
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
  const response = await fetch("/api/ai/resume", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  const data = parseResponseJson(await response.text())
  if (!response.ok) throw new Error(readErrorMessage(data))
  return data as AiResumeResponse
}

function parseResponseJson(text: string): unknown {
  if (!text) {
    throw new Error("服务端没有返回内容")
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error(`服务端返回内容不是合法 JSON：${text}`)
  }
}

function readErrorMessage(data: unknown): string {
  if (data && typeof data === "object" && "error" in data) {
    return String((data as { error: unknown }).error)
  }
  return "请求失败"
}

function findTargetRole(resumeData: ResumeData): string {
  const items = resumeData.jobIntentionSection?.items ?? []
  return items.find((item) => item.type === "position")?.value ?? ""
}
