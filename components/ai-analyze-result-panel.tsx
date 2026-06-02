"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AiResumeResponse } from "@/types/ai-resume"
import { Icon } from "@iconify/react"

interface AiAnalyzeResultPanelProps {
  readonly result: AiResumeResponse
  readonly isLoading: boolean
  readonly onRegenerate: () => void
}

export default function AiAnalyzeResultPanel({ result, isLoading, onRegenerate }: AiAnalyzeResultPanelProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-background p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-medium">匹配度分析</h3>
          <Button size="sm" variant="outline" onClick={onRegenerate} disabled={isLoading} className="gap-2 bg-transparent">
            <Icon icon="mdi:refresh" className="h-4 w-4" />
            重新分析
          </Button>
        </div>
        {result.matchScore !== undefined ? <MatchScore score={result.matchScore} /> : null}
        <p className="text-sm leading-6 text-muted-foreground">{result.summary}</p>
      </div>
      <KeywordSection title="匹配点" keywords={result.matchedKeywords} />
      <KeywordSection title="缺失点" keywords={result.missingKeywords} />
      <DirectionSection directions={result.improvementDirections ?? []} />
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

function KeywordSection({ title, keywords }: { readonly title: string; readonly keywords: readonly string[] }) {
  if (keywords.length === 0) return null
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-3 text-sm font-medium">{title}</div>
      <div className="flex flex-wrap gap-2">
        {keywords.map((keyword) => (
          <Badge key={keyword} variant="secondary" className="text-xs">
            {keyword}
          </Badge>
        ))}
      </div>
    </div>
  )
}

function DirectionSection({ directions }: { readonly directions: readonly string[] }) {
  if (directions.length === 0) return null
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-3 text-sm font-medium">改进方向</div>
      <div className="space-y-2">
        {directions.map((direction) => (
          <div key={direction} className="rounded-md bg-muted/40 p-3 text-sm leading-6 text-muted-foreground">
            {direction}
          </div>
        ))}
      </div>
    </div>
  )
}
