"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import type {
  AiInterviewAdviceResponse,
  InterviewAdviceItem,
  InterviewAdviceSection,
  InterviewQuestion,
  InterviewSelfIntroduction,
} from "@/types/interview-advice"
import { Icon } from "@iconify/react"

interface InterviewAdvicePanelProps {
  readonly result: AiInterviewAdviceResponse | null
  readonly isLoading: boolean
  readonly onRegenerate: () => void
}

type TabValue = "advice" | "questions"

export default function InterviewAdvicePanel({ result, isLoading, onRegenerate }: InterviewAdvicePanelProps) {
  const { toast } = useToast()
  const [tab, setTab] = useState<TabValue>("advice")
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "已复制", description: "内容已复制到剪贴板" })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast({ title: "复制失败", description: message, variant: "destructive" })
    }
  }

  if (!result) return <EmptyState isLoading={isLoading} />

  return (
    <div className="space-y-4">
      <div className="grid h-9 w-full grid-cols-2 rounded-lg bg-muted p-[3px] text-sm text-muted-foreground">
        <TabButton active={tab === "advice"} icon="mdi:clipboard-list-outline" onClick={() => setTab("advice")}>
          面试建议
        </TabButton>
        <TabButton active={tab === "questions"} icon="mdi:comment-question-outline" onClick={() => setTab("questions")}>
          可能问题
        </TabButton>
      </div>
      {tab === "advice" ? (
        <AdvicePage result={result} isLoading={isLoading} onRegenerate={onRegenerate} />
      ) : (
        <QuestionsPage result={result} onCopy={copy} />
      )}
    </div>
  )
}

function TabButton({
  active,
  children,
  icon,
  onClick,
}: {
  readonly active: boolean
  readonly children: string
  readonly icon: string
  readonly onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-2 py-1 font-medium transition-colors ${
        active ? "bg-background text-foreground shadow-sm" : "hover:text-foreground"
      }`}
    >
      <Icon icon={icon} className="h-4 w-4" />
      {children}
    </button>
  )
}

function EmptyState({ isLoading }: { readonly isLoading: boolean }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
      <Icon
        icon={isLoading ? "mdi:loading" : "mdi:briefcase-search"}
        className={`mx-auto mb-2 h-7 w-7 ${isLoading ? "animate-spin" : ""}`}
      />
      {isLoading ? "正在读取简历并生成面试准备..." : "暂无面试建议"}
    </div>
  )
}

function AdvicePage({
  result,
  isLoading,
  onRegenerate,
}: {
  readonly result: AiInterviewAdviceResponse
  readonly isLoading: boolean
  readonly onRegenerate: () => void
}) {
  return (
    <div className="space-y-4">
      <OverviewCard result={result} isLoading={isLoading} onRegenerate={onRegenerate} />
      {result.adviceSections.map((section) => (
        <AdviceSection key={section.title} section={section} />
      ))}
    </div>
  )
}

function OverviewCard({
  result,
  isLoading,
  onRegenerate,
}: {
  readonly result: AiInterviewAdviceResponse
  readonly isLoading: boolean
  readonly onRegenerate: () => void
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-medium">准备总览</h3>
        <Button size="sm" variant="outline" onClick={onRegenerate} disabled={isLoading} className="gap-2 bg-transparent">
          <Icon icon="mdi:refresh" className="h-4 w-4" />
          重新生成
        </Button>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{result.overview}</p>
      <div className="mt-3 rounded-md bg-muted/40 p-3 text-sm leading-6">
        <div className="mb-1 text-xs text-muted-foreground">工作性质</div>
        {result.workNature}
      </div>
    </div>
  )
}

function AdviceSection({ section }: { readonly section: InterviewAdviceSection }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-3">
        <h3 className="font-medium">{section.title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{section.focus}</p>
      </div>
      <div className="space-y-3">
        {section.items.map((item) => (
          <AdviceItem key={item.title} item={item} />
        ))}
      </div>
    </div>
  )
}

function AdviceItem({ item }: { readonly item: InterviewAdviceItem }) {
  return (
    <div className="rounded-md bg-muted/35 p-3">
      <div className="text-sm font-medium">{item.title}</div>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
        {item.actions.map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ul>
    </div>
  )
}

function QuestionsPage({
  result,
  onCopy,
}: {
  readonly result: AiInterviewAdviceResponse
  readonly onCopy: (text: string) => void
}) {
  return (
    <div className="space-y-4">
      <SelfIntroductionCard selfIntroduction={result.selfIntroduction} onCopy={onCopy} />
      {result.questions.map((question, index) => (
        <QuestionItem key={`${question.question}-${index}`} question={question} onCopy={onCopy} />
      ))}
    </div>
  )
}

function SelfIntroductionCard({
  selfIntroduction,
  onCopy,
}: {
  readonly selfIntroduction: InterviewSelfIntroduction
  readonly onCopy: (text: string) => void
}) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-medium">自我介绍</h3>
        <Button size="sm" variant="outline" onClick={() => onCopy(selfIntroduction.content)} className="gap-2 bg-transparent">
          <Icon icon="mdi:content-copy" className="h-4 w-4" />
          复制
        </Button>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-6">{selfIntroduction.content}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {selfIntroduction.keyPoints.map((point) => (
          <Badge key={point} variant="secondary" className="text-xs">
            {point}
          </Badge>
        ))}
      </div>
    </div>
  )
}

function QuestionItem({
  question,
  onCopy,
}: {
  readonly question: InterviewQuestion
  readonly onCopy: (text: string) => void
}) {
  const copyText = `问题：${question.question}\n\n参考答案：${question.answer}`
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Badge variant="secondary" className="text-xs">
            {question.category}
          </Badge>
          <h3 className="text-sm font-medium leading-6">{question.question}</h3>
        </div>
        <Button size="sm" variant="outline" onClick={() => onCopy(copyText)} className="gap-2 bg-transparent">
          <Icon icon="mdi:content-copy" className="h-4 w-4" />
          复制
        </Button>
      </div>
      <div className="rounded-md bg-muted/40 p-3 text-sm leading-6 whitespace-pre-wrap">{question.answer}</div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">依据：{question.resumeBasis}</p>
    </div>
  )
}
