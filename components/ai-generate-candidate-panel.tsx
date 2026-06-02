"use client"

import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import type { AiGeneratedSection, AiResumeResponse, AiResumeSuggestion } from "@/types/ai-resume"
import { Icon } from "@iconify/react"

interface AiGenerateCandidatePanelProps {
  readonly result: AiResumeResponse
  readonly isLoading: boolean
  readonly onApply: (suggestion: AiResumeSuggestion) => void
  readonly onRegenerate: () => void
}

export default function AiGenerateCandidatePanel(props: AiGenerateCandidatePanelProps) {
  const sections = props.result.generatedSections ?? []
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-background p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-medium">候选内容</h3>
          <Button size="sm" variant="outline" onClick={props.onRegenerate} disabled={props.isLoading} className="gap-2 bg-transparent">
            <Icon icon="mdi:refresh" className="h-4 w-4" />
            重新生成
          </Button>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{props.result.summary}</p>
      </div>
      <div className="space-y-3">
        {sections.map((section) => (
          <CandidateItem
            key={section.section}
            section={section}
            suggestion={findSuggestion(props.result.suggestions, section)}
            onApply={props.onApply}
          />
        ))}
      </div>
    </div>
  )
}

function CandidateItem({
  section,
  suggestion,
  onApply,
}: {
  readonly section: AiGeneratedSection
  readonly suggestion: AiResumeSuggestion | null
  readonly onApply: (suggestion: AiResumeSuggestion) => void
}) {
  const { toast } = useToast()
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(section.content)
      toast({ title: "已复制", description: `${section.title}候选内容已复制` })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast({ title: "复制失败", description: message, variant: "destructive" })
    }
  }
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h4 className="font-medium">{section.title}</h4>
          <p className="mt-1 text-xs text-muted-foreground">候选草稿，确认后再复制或应用。</p>
        </div>
      </div>
      <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm leading-6 whitespace-pre-wrap">
        {section.content}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={copy} className="gap-2 bg-transparent">
          <Icon icon="mdi:content-copy" className="h-4 w-4" />
          复制
        </Button>
        {suggestion ? (
          <Button size="sm" onClick={() => onApply(suggestion)} className="gap-2">
            <Icon icon="mdi:check" className="h-4 w-4" />
            应用到模块
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function findSuggestion(
  suggestions: readonly AiResumeSuggestion[],
  section: AiGeneratedSection,
): AiResumeSuggestion | null {
  return suggestions.find((suggestion) => {
    return suggestion.section === section.section && suggestion.target.type === "moduleContent"
  }) ?? null
}
