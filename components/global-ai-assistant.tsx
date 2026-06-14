"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Icon } from "@iconify/react"
import { useGlobalAiConversation, type UiGlobalAiMessage } from "./use-global-ai-conversation"
import { useModuleAiWindow } from "./use-module-ai-window"
import { createModuleRowsFromDrafts } from "@/lib/module-ai/draft-rows"
import { useToast } from "@/hooks/use-toast"
import type { ResumeData } from "@/types/resume"
import type { GlobalAiModuleDraft } from "@/types/global-ai"
import type { FormEvent, KeyboardEvent } from "react"

interface GlobalAiAssistantProps {
  readonly resumeData: ResumeData
  readonly onApplyResumeData: (resumeData: ResumeData) => void
}

export default function GlobalAiAssistant(props: GlobalAiAssistantProps) {
  const { actions, state } = useGlobalAiConversation({ resumeData: props.resumeData })
  const windowState = useModuleAiWindow(state.open)

  return (
    <Dialog open={state.open} onOpenChange={actions.updateOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="relative justify-center gap-2 px-3 py-1.5 text-foreground hover:bg-primary/10 hover:text-primary"
        >
          <Icon icon="mdi:chat-processing" className="h-4 w-4" />
          <span className="hidden sm:inline">AI 对话</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        onClick={(event) => event.stopPropagation()}
        style={windowState.style}
        className="flex !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader
          onPointerDown={windowState.onMovePointerDown}
          className="cursor-move select-none border-b px-4 py-3 pr-12"
        >
          <DialogTitle className="flex items-center gap-2 text-base">
            <Icon icon="mdi:robot-conversation" className="h-4 w-4 text-primary" />
            全局 AI 对话助手
          </DialogTitle>
          <DialogDescription>可以跨模块分析和修改整份简历。关闭窗口后，对话上下文会立即清空。</DialogDescription>
        </DialogHeader>
        <GlobalAiPanel
          actions={actions}
          state={state}
          resumeData={props.resumeData}
          onApplyResumeData={props.onApplyResumeData}
        />
        <ResizeHandle onPointerDown={windowState.onResizePointerDown} />
      </DialogContent>
    </Dialog>
  )
}

function GlobalAiPanel({
  actions,
  state,
  resumeData,
  onApplyResumeData,
}: {
  readonly actions: ReturnType<typeof useGlobalAiConversation>["actions"]
  readonly state: ReturnType<typeof useGlobalAiConversation>["state"]
  readonly resumeData: ResumeData
  readonly onApplyResumeData: (resumeData: ResumeData) => void
}) {
  const moduleCount = resumeData.modules.length
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ResumeContextSummary moduleCount={moduleCount} />
      <ChatMessages
        actions={actions}
        state={state}
        resumeData={resumeData}
        onApplyResumeData={onApplyResumeData}
      />
      <MessageForm actions={actions} input={state.input} isLoading={state.isLoading} />
    </div>
  )
}

function ChatMessages({
  actions,
  state,
  resumeData,
  onApplyResumeData,
}: {
  readonly actions: ReturnType<typeof useGlobalAiConversation>["actions"]
  readonly state: ReturnType<typeof useGlobalAiConversation>["state"]
  readonly resumeData: ResumeData
  readonly onApplyResumeData: (resumeData: ResumeData) => void
}) {
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
      {state.messages.length === 0 ? <EmptyState /> : null}
      {state.messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          resumeData={resumeData}
          onApplyResumeData={onApplyResumeData}
        />
      ))}
      {state.isLoading ? <LoadingBubble /> : null}
      {state.error ? <ErrorPanel message={state.error} /> : null}
    </div>
  )
}

function MessageForm({
  actions,
  input,
  isLoading,
}: {
  readonly actions: ReturnType<typeof useGlobalAiConversation>["actions"]
  readonly input: string
  readonly isLoading: boolean
}) {
  return (
    <form
      className="space-y-2 border-t p-3"
      onSubmit={(event) => handleSubmitEvent(event, actions.submit)}
    >
      <Textarea
        value={input}
        onChange={(event) => actions.updateInput(event.target.value)}
        onKeyDown={(event) => handleMessageKeyDown(event, actions.submit)}
        placeholder="例如：帮我优化项目经历，突出全栈能力"
        className="min-h-20 resize-none"
      />
      <div className="flex justify-end">
        <Button size="sm" type="submit" disabled={!input.trim() || isLoading} className="gap-2">
          <Icon
            icon={isLoading ? "mdi:loading" : "mdi:send"}
            className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
          />
          发送
        </Button>
      </div>
    </form>
  )
}

function ResumeContextSummary({ moduleCount }: { readonly moduleCount: number }) {
  return (
    <div className="border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
      已读取完整简历，包含 {moduleCount} 个模块。
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      你可以让 AI 分析简历、优化某个模块，或者根据 JD 生成内容。
    </div>
  )
}

function MessageBubble({
  message,
  resumeData,
  onApplyResumeData,
}: {
  readonly message: UiGlobalAiMessage
  readonly resumeData: ResumeData
  readonly onApplyResumeData: (resumeData: ResumeData) => void
}) {
  const isAssistant = message.role === "assistant"
  return (
    <div className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[86%] rounded-lg px-3 py-2 text-sm ${
          isAssistant ? "bg-muted" : "bg-primary text-primary-foreground"
        }`}
      >
        <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
        {isAssistant && message.drafts?.length ? (
          <DraftsPreview
            drafts={message.drafts}
            resumeData={resumeData}
            onApplyResumeData={onApplyResumeData}
          />
        ) : null}
      </div>
    </div>
  )
}

function DraftsPreview({
  drafts,
  resumeData,
  onApplyResumeData,
}: {
  readonly drafts: readonly GlobalAiModuleDraft[]
  readonly resumeData: ResumeData
  readonly onApplyResumeData: (resumeData: ResumeData) => void
}) {
  const { toast } = useToast()

  const applyDraft = (draft: GlobalAiModuleDraft) => {
    try {
      const targetModule = resumeData.modules.find((m) => m.id === draft.moduleId)
      if (!targetModule) {
        throw new Error(`未找到模块：${draft.moduleName}`)
      }
      const newRows = createModuleRowsFromDrafts(draft.rows)
      const updatedModules = resumeData.modules.map((m) =>
        m.id === draft.moduleId ? { ...m, rows: newRows } : m
      )
      onApplyResumeData({ ...resumeData, modules: updatedModules })
      toast({ title: "已应用 AI 内容", description: draft.moduleName })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast({ title: "应用失败", description: message, variant: "destructive" })
    }
  }

  const applyAll = () => {
    try {
      let updatedResumeData = resumeData
      for (const draft of drafts) {
        const targetModule = updatedResumeData.modules.find((m) => m.id === draft.moduleId)
        if (!targetModule) continue
        const newRows = createModuleRowsFromDrafts(draft.rows)
        updatedResumeData = {
          ...updatedResumeData,
          modules: updatedResumeData.modules.map((m) =>
            m.id === draft.moduleId ? { ...m, rows: newRows } : m
          ),
        }
      }
      onApplyResumeData(updatedResumeData)
      toast({ title: "已全部应用", description: `成功应用 ${drafts.length} 个模块的修改` })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast({ title: "应用失败", description: message, variant: "destructive" })
    }
  }

  return (
    <div className="mt-3 space-y-2 border-t border-muted-foreground/20 pt-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">AI 生成的内容</span>
        {drafts.length > 1 ? (
          <Button size="sm" variant="secondary" onClick={applyAll} className="h-6 gap-1 text-xs">
            <Icon icon="mdi:check-all" className="h-3 w-3" />
            全部应用
          </Button>
        ) : null}
      </div>
      {drafts.map((draft) => (
        <Card key={draft.moduleId} className="bg-background p-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {draft.moduleName}
                </Badge>
                <span className="text-xs text-muted-foreground">{draft.rows.length} 行</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {draft.rows.slice(0, 2).map((row, idx) => (
                  <div key={idx} className="truncate">
                    {row.type === "rich"
                      ? row.columns.join(" · ")
                      : row.type === "tags"
                      ? row.tags.join("、")
                      : ""}
                  </div>
                ))}
                {draft.rows.length > 2 ? <div>...</div> : null}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => applyDraft(draft)}
              className="h-7 shrink-0 gap-1 text-xs"
            >
              <Icon icon="mdi:check" className="h-3 w-3" />
              应用
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}

function LoadingBubble() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[86%] rounded-lg bg-muted px-3 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon icon="mdi:loading" className="h-4 w-4 animate-spin" />
          AI 思考中...
        </div>
      </div>
    </div>
  )
}

function ErrorPanel({ message }: { readonly message: string }) {
  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
      <div className="flex items-start gap-2">
        <Icon icon="mdi:alert-circle" className="h-4 w-4 shrink-0 text-destructive" />
        <p className="text-sm text-destructive">{message}</p>
      </div>
    </div>
  )
}

function ResizeHandle({ onPointerDown }: { readonly onPointerDown: (event: PointerEvent) => void }) {
  return (
    <div
      onPointerDown={onPointerDown}
      className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
      style={{ touchAction: "none" }}
    />
  )
}

function handleSubmitEvent(event: FormEvent, submit: () => void) {
  event.preventDefault()
  submit()
}

function handleMessageKeyDown(event: KeyboardEvent<HTMLTextAreaElement>, submit: () => void) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault()
    submit()
  }
}
