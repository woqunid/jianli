"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import type { AiResumeResponse, AiResumeSection, AiResumeSuggestion } from "@/types/ai-resume"
import { Icon } from "@iconify/react"

interface AiSuggestionPanelProps {
  readonly result: AiResumeResponse | null
  readonly isLoading: boolean
  readonly onApply: (suggestion: AiResumeSuggestion) => void
  readonly onRegenerate: () => void
}

export default function AiSuggestionPanel(props: AiSuggestionPanelProps) {
  const { toast } = useToast()
  const [ignored, setIgnored] = useState<ReadonlySet<number>>(new Set())
  const [applied, setApplied] = useState<ReadonlySet<number>>(new Set())

  useEffect(() => {
    setIgnored(new Set())
    setApplied(new Set())
  }, [props.result])

  if (!props.result) {
    return <EmptyState isLoading={props.isLoading} />
  }

  const apply = (suggestion: AiResumeSuggestion, index: number) => {
    props.onApply(suggestion)
    setApplied((prev) => new Set(prev).add(index))
  }

  const ignore = (index: number) => {
    setIgnored((prev) => new Set(prev).add(index))
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "已复制", description: "候选内容已复制到剪贴板" })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast({ title: "复制失败", description: message, variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4">
      <Summary result={props.result} onRegenerate={props.onRegenerate} isLoading={props.isLoading} />
      <div className="space-y-3">
        {props.result.suggestions.map((suggestion, index) => (
          <SuggestionItem
            key={`${suggestion.title}-${index}`}
            suggestion={suggestion}
            ignored={ignored.has(index)}
            applied={applied.has(index)}
            onApply={() => apply(suggestion, index)}
            onCopy={() => copy(suggestion.after)}
            onIgnore={() => ignore(index)}
          />
        ))}
      </div>
    </div>
  )
}

function EmptyState({ isLoading }: { readonly isLoading: boolean }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
      <Icon
        icon={isLoading ? "mdi:loading" : "mdi:creation"}
        className={`mx-auto mb-2 h-7 w-7 ${isLoading ? "animate-spin" : ""}`}
      />
      {isLoading ? "正在分析简历与 JD..." : "填写 JD 后生成匹配度分析和优化建议"}
    </div>
  )
}

function Summary({
  result,
  isLoading,
  onRegenerate,
}: {
  readonly result: AiResumeResponse
  readonly isLoading: boolean
  readonly onRegenerate: () => void
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-medium">AI 分析结果</h3>
        <Button size="sm" variant="outline" onClick={onRegenerate} disabled={isLoading} className="gap-2 bg-transparent">
          <Icon icon="mdi:refresh" className="h-4 w-4" />
          重新生成
        </Button>
      </div>
      {result.matchScore !== undefined ? <MatchScore score={result.matchScore} /> : null}
      <p className="text-sm leading-6 text-muted-foreground">{result.summary}</p>
      <KeywordList label={result.matchScore === undefined ? "匹配关键词" : "匹配内容"} keywords={result.matchedKeywords} />
      <KeywordList label={result.matchScore === undefined ? "待补充关键词" : "不匹配内容"} keywords={result.missingKeywords} />
      <GeneratedSections result={result} />
    </div>
  )
}

function MatchScore({ score }: { readonly score: number }) {
  return (
    <div className="mb-3 rounded-md border border-primary/20 bg-primary/5 p-3">
      <div className="text-xs text-muted-foreground">匹配度</div>
      <div className="mt-1 text-2xl font-semibold text-primary">{score}%</div>
    </div>
  )
}

function KeywordList({ label, keywords }: { readonly label: string; readonly keywords: readonly string[] }) {
  if (keywords.length === 0) return null
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      {keywords.map((keyword) => (
        <Badge key={keyword} variant="secondary" className="text-xs">
          {keyword}
        </Badge>
      ))}
    </div>
  )
}

function GeneratedSections({ result }: { readonly result: AiResumeResponse }) {
  if (!result.generatedSections?.length) return null
  return (
    <div className="mt-4 space-y-3">
      {result.generatedSections.map((section) => (
        <div key={section.section} className="rounded-md border bg-muted/30 p-3">
          <div className="mb-1 text-xs font-medium text-muted-foreground">{readSectionLabel(section.section)}</div>
          <div className="text-sm leading-6 whitespace-pre-wrap">{section.content}</div>
        </div>
      ))}
    </div>
  )
}

function SuggestionItem({
  suggestion,
  applied,
  ignored,
  onApply,
  onCopy,
  onIgnore,
}: {
  readonly suggestion: AiResumeSuggestion
  readonly applied: boolean
  readonly ignored: boolean
  readonly onApply: () => void
  readonly onCopy: () => void
  readonly onIgnore: () => void
}) {
  return (
    <div className={`rounded-lg border bg-background p-4 ${ignored ? "opacity-50" : ""}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h4 className="font-medium">{suggestion.title}</h4>
          <p className="mt-1 text-xs text-muted-foreground">{suggestion.reason}</p>
        </div>
        {applied ? <Badge>已应用</Badge> : null}
      </div>
      <BeforeAfter suggestion={suggestion} />
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCopy} className="gap-2 bg-transparent">
          <Icon icon="mdi:content-copy" className="h-4 w-4" />
          复制
        </Button>
        <Button size="sm" variant="ghost" onClick={onIgnore} disabled={ignored}>
          忽略
        </Button>
        <Button size="sm" onClick={onApply} disabled={applied || ignored} className="gap-2">
          <Icon icon="mdi:check" className="h-4 w-4" />
          应用
        </Button>
      </div>
    </div>
  )
}

function readSectionLabel(section: AiResumeSection): string {
  const labels: Readonly<Record<AiResumeSection, string>> = {
    jobIntention: "求职意向",
    skills: "专业技能",
    experience: "工作经历",
    projects: "项目经历",
    careerSkills: "职业技能",
    summary: "个人总结",
    proofread: "全文纠错",
    jdAnalysis: "JD 匹配度分析",
  }
  return labels[section]
}

function BeforeAfter({ suggestion }: { readonly suggestion: AiResumeSuggestion }) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <div className="mb-1 text-xs text-muted-foreground">当前内容</div>
        <div className="rounded-md bg-muted/50 p-3 leading-6 whitespace-pre-wrap">{suggestion.before}</div>
      </div>
      <Separator />
      <div>
        <div className="mb-1 text-xs text-muted-foreground">候选优化</div>
        <div className="rounded-md border border-primary/20 bg-primary/5 p-3 leading-6 whitespace-pre-wrap">
          {suggestion.after}
        </div>
      </div>
    </div>
  )
}
