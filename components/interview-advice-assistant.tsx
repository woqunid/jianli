"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useToast } from "@/hooks/use-toast"
import { requestJson } from "@/lib/fetch-json"
import type { AiInterviewAdviceResponse } from "@/types/interview-advice"
import type { ResumeData } from "@/types/resume"
import { Icon } from "@iconify/react"
import InterviewAdvicePanel from "./interview-advice-panel"

interface InterviewAdviceAssistantProps {
  readonly resumeData: ResumeData
}

export default function InterviewAdviceAssistant({ resumeData }: InterviewAdviceAssistantProps) {
  const { toast } = useToast()
  const resumeStamp = resumeData.updatedAt
  const autoRequestedFor = useRef("")
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [lastGeneratedStamp, setLastGeneratedStamp] = useState("")
  const [result, setResult] = useState<AiInterviewAdviceResponse | null>(null)

  const submit = useCallback(async () => {
    if (isLoading) return
    setIsLoading(true)
    try {
      const response = await requestInterviewAdvice({ resumeData })
      setResult(response)
      setLastGeneratedStamp(resumeStamp)
      toast({ title: "面试建议已生成", description: `生成 ${response.questions.length} 个可能面试问题` })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast({ title: "面试建议生成失败", description: message, variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, resumeData, resumeStamp, toast])

  useEffect(() => {
    if (!isOpen || isLoading) return
    if (lastGeneratedStamp === resumeStamp) return
    if (autoRequestedFor.current === resumeStamp) return
    autoRequestedFor.current = resumeStamp
    void submit()
  }, [isOpen, isLoading, lastGeneratedStamp, resumeStamp, submit])

  const updateOpen = (open: boolean) => {
    setIsOpen(open)
  }

  const regenerate = () => {
    autoRequestedFor.current = ""
    void submit()
  }

  return (
    <Sheet open={isOpen} onOpenChange={updateOpen}>
      <SheetTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="relative min-w-[104px] justify-center gap-2 px-3 py-1.5 text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          <Icon icon="mdi:account-question" className="h-4 w-4" />
          面试建议
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="border-b">
          <SheetTitle>面试建议</SheetTitle>
          <SheetDescription>根据当前简历生成准备建议、自我介绍和可能面试问题。</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          <Button onClick={regenerate} disabled={isLoading} className="w-full gap-2">
            <Icon
              icon={isLoading ? "mdi:loading" : "mdi:briefcase-search"}
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            {isLoading ? "生成中" : result ? "重新生成面试建议" : "生成面试建议"}
          </Button>
          <InterviewAdvicePanel result={result} isLoading={isLoading} onRegenerate={regenerate} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

function requestInterviewAdvice(input: {
  readonly resumeData: ResumeData
}): Promise<AiInterviewAdviceResponse> {
  return requestJson<AiInterviewAdviceResponse>("/api/ai/interview-advice", input)
}
