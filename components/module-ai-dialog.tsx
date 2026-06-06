"use client"

import { useMemo, type FormEvent, type KeyboardEvent } from "react"
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
import { readModulePlainText } from "@/lib/ai/resume-requirements"
import type { ResumeModule } from "@/types/resume"
import { Icon } from "@iconify/react"
import ModuleAiAppliedPreview from "./module-ai-applied-preview"
import {
  useModuleAiConversation,
  type ModuleAiConversationActions,
  type ModuleAiConversationState,
  type UiModuleAiMessage,
} from "./module-ai-conversation"

interface ModuleAiDialogProps {
  readonly module: ResumeModule
  readonly onApplyRows: (rows: ResumeModule["rows"]) => void
}

export default function ModuleAiDialog(props: ModuleAiDialogProps) {
  const moduleText = useMemo(() => readModulePlainText(props.module), [props.module])
  const { actions, state } = useModuleAiConversation(props)

  return (
    <Dialog open={state.open} onOpenChange={actions.updateOpen}>
      <ModuleAiTrigger />
      <DialogContent
        onClick={(event) => event.stopPropagation()}
        className="gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Icon icon="mdi:robot-outline" className="h-4 w-4 text-primary" />
            {props.module.title || "未命名模块"} AI 对话
          </DialogTitle>
          <DialogDescription>关闭窗口后，本轮对话上下文会立即清空。</DialogDescription>
        </DialogHeader>
        <ModuleAiPanel actions={actions} module={props.module} moduleText={moduleText} state={state} />
      </DialogContent>
    </Dialog>
  )
}

function ModuleAiTrigger() {
  return (
    <DialogTrigger asChild>
      <Button
        size="sm"
        variant="ghost"
        title="AI 对话"
        onClick={(event) => event.stopPropagation()}
        className="h-8 w-8 p-0 text-primary hover:bg-primary/10 hover:text-primary"
      >
        <Icon icon="mdi:robot-outline" className="h-4 w-4" />
      </Button>
    </DialogTrigger>
  )
}

function ModuleAiPanel({
  actions,
  module,
  moduleText,
  state,
}: {
  readonly actions: ModuleAiConversationActions
  readonly module: ResumeModule
  readonly moduleText: string
  readonly state: ModuleAiConversationState
}) {
  return (
    <div className="flex h-[520px] max-h-[calc(82vh-96px)] flex-col">
      <ModuleContextSummary hasContent={Boolean(moduleText)} title={module.title} />
      <ChatMessages actions={actions} hasContent={Boolean(moduleText)} state={state} />
      <MessageForm actions={actions} input={state.input} isLoading={state.isLoading} />
    </div>
  )
}

function ChatMessages({
  actions,
  hasContent,
  state,
}: {
  readonly actions: ModuleAiConversationActions
  readonly hasContent: boolean
  readonly state: ModuleAiConversationState
}) {
  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
      {state.messages.length === 0 ? <EmptyState hasContent={hasContent} /> : null}
      {state.messages.map((message) => (
        <MessageBubble key={message.id} message={message} onApply={actions.applyMessage} />
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
  readonly actions: ModuleAiConversationActions
  readonly input: string
  readonly isLoading: boolean
}) {
  return (
    <form className="space-y-2 border-t p-3" onSubmit={(event) => handleSubmitEvent(event, actions.submit)}>
      <Textarea
        value={input}
        onChange={(event) => actions.updateInput(event.target.value)}
        onKeyDown={(event) => handleMessageKeyDown(event, actions.submit)}
        placeholder="输入想优化、补充或生成的内容"
        className="min-h-20 resize-none"
      />
      <div className="flex justify-end">
        <Button size="sm" type="submit" disabled={!input.trim() || isLoading} className="gap-2">
          <Icon icon={isLoading ? "mdi:loading" : "mdi:send"} className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          发送
        </Button>
      </div>
    </form>
  )
}

function ModuleContextSummary({ hasContent, title }: { readonly hasContent: boolean; readonly title: string }) {
  return (
    <div className="border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
      已读取「{title || "未命名模块"}」{hasContent ? "当前填写内容" : "空模块状态"}。
    </div>
  )
}

function EmptyState({ hasContent }: { readonly hasContent: boolean }) {
  return (
    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      {hasContent ? "可以让 AI 润色、改写或补充当前模块。" : "可以先告诉 AI 你的经历、技能或项目要点。"}
    </div>
  )
}

function MessageBubble({
  message,
  onApply,
}: {
  readonly message: UiModuleAiMessage
  readonly onApply: (message: UiModuleAiMessage) => void
}) {
  const isAssistant = message.role === "assistant"
  return (
    <div className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[86%] rounded-lg px-3 py-2 text-sm ${isAssistant ? "bg-muted" : "bg-primary text-primary-foreground"}`}>
        <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
        {isAssistant && message.rows?.length ? <ModuleAiAppliedPreview applied={message.applied} rows={message.rows} /> : null}
        {isAssistant ? <ApplyButton message={message} onApply={onApply} /> : null}
      </div>
    </div>
  )
}

function ApplyButton({
  message,
  onApply,
}: {
  readonly message: UiModuleAiMessage
  readonly onApply: (message: UiModuleAiMessage) => void
}) {
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={message.applied || !message.rows?.length}
      title={message.rows?.length ? "应用到当前模块" : "这条回复暂无可应用内容"}
      onClick={() => onApply(message)}
      className="mt-2 h-7 gap-1 bg-background px-2 text-xs"
    >
      <Icon icon={message.applied ? "mdi:check" : "mdi:content-save-edit-outline"} className="h-3.5 w-3.5" />
      {message.applied ? "已应用" : "应用"}
    </Button>
  )
}

function LoadingBubble() {
  return (
    <div className="flex justify-start">
      <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        <Icon icon="mdi:loading" className="mr-2 inline h-4 w-4 animate-spin" />
        生成中
      </div>
    </div>
  )
}

function ErrorPanel({ message }: { readonly message: string }) {
  return <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{message}</div>
}

function handleSubmitEvent(event: FormEvent<HTMLFormElement>, submit: () => void): void {
  event.preventDefault()
  submit()
}

function handleMessageKeyDown(event: KeyboardEvent<HTMLTextAreaElement>, submit: () => void): void {
  if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return
  event.preventDefault()
  submit()
}
