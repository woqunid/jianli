"use client"

import {
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react"
import { useToast } from "@/hooks/use-toast"
import { withStoredAiRequestConfig } from "@/lib/ai/client-config-storage"
import { applyModuleAiChanges } from "@/lib/module-ai/module-changes"
import type { ModuleAiChange, ModuleAiMessage, ModuleAiResponse } from "@/types/module-ai"
import type { ModuleContentRow, ResumeModule } from "@/types/resume"

export interface UiModuleAiMessage extends ModuleAiMessage {
  readonly id: string
  readonly changes?: readonly ModuleAiChange[]
  readonly applied?: boolean
}

export interface ModuleAiConversationState {
  readonly error: string | null
  readonly input: string
  readonly isLoading: boolean
  readonly messages: readonly UiModuleAiMessage[]
  readonly open: boolean
}

export interface ModuleAiConversationActions {
  readonly applyMessage: (message: UiModuleAiMessage) => void
  readonly submit: () => void
  readonly updateInput: (value: string) => void
  readonly updateOpen: (open: boolean) => void
}

interface ModuleAiConversationProps {
  readonly module: ResumeModule
  readonly onApplyRows: (rows: ModuleContentRow[]) => void
}

interface ConversationSetters {
  readonly setError: Dispatch<SetStateAction<string | null>>
  readonly setInput: Dispatch<SetStateAction<string>>
  readonly setIsLoading: Dispatch<SetStateAction<boolean>>
  readonly setMessages: Dispatch<SetStateAction<UiModuleAiMessage[]>>
}

const ID_RANDOM_END = 11
const ID_RANDOM_START = 2
const RANDOM_ID_RADIX = 36

export function useModuleAiConversation(props: ModuleAiConversationProps): {
  readonly actions: ModuleAiConversationActions
  readonly state: ModuleAiConversationState
} {
  const { toast } = useToast()
  const requestRef = useRef<AbortController | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<UiModuleAiMessage[]>([])
  const [open, setOpen] = useState(false)

  const updateOpen = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) resetSession({ requestRef, setError, setInput, setIsLoading, setMessages })
  }
  const submit = () => {
    void sendMessage({ input, isLoading, messages, module: props.module, requestRef, setError, setInput, setIsLoading, setMessages, toast })
  }
  const applyMessage = (message: UiModuleAiMessage) => {
    applyRowsMessage({ message, module: props.module, onApplyRows: props.onApplyRows, setMessages, toast })
  }

  return {
    actions: { applyMessage, submit, updateInput: setInput, updateOpen },
    state: { error, input, isLoading, messages, open },
  }
}

async function sendMessage(options: SendMessageOptions): Promise<void> {
  const content = options.input.trim()
  if (!content || options.isLoading) return
  const userMessage = createUiMessage("user", content)
  const nextMessages = [...options.messages, userMessage]
  options.setMessages(nextMessages)
  options.setInput("")
  options.setError(null)
  options.setIsLoading(true)
  const controller = new AbortController()
  options.requestRef.current = controller
  try {
    const response = await requestModuleAi(options.module, nextMessages, controller.signal)
    options.setMessages([...nextMessages, createAssistantMessage(response)])
  } catch (caught) {
    handleRequestError(caught, options)
  } finally {
    finishRequest(options.requestRef, controller, options.setIsLoading)
  }
}

interface SendMessageOptions extends ConversationSetters {
  readonly input: string
  readonly isLoading: boolean
  readonly messages: readonly UiModuleAiMessage[]
  readonly module: ResumeModule
  readonly requestRef: MutableRefObject<AbortController | null>
  readonly toast: ReturnType<typeof useToast>["toast"]
}

function handleRequestError(caught: unknown, options: SendMessageOptions): void {
  if (isAbortError(caught)) return
  const message = caught instanceof Error ? caught.message : String(caught)
  options.setError(message)
  options.toast({ title: "AI 对话失败", description: message, variant: "destructive" })
}

function applyRowsMessage(options: ApplyRowsMessageOptions): void {
  try {
    options.onApplyRows(applyModuleAiChanges(options.module, options.message.changes ?? []).rows)
    options.setMessages((prev) => markApplied(prev, options.message.id))
    options.toast({ title: "已应用 AI 内容", description: options.module.title || "当前模块" })
  } catch (caught) {
    const description = caught instanceof Error ? caught.message : String(caught)
    options.toast({ title: "应用失败", description, variant: "destructive" })
  }
}

interface ApplyRowsMessageOptions {
  readonly message: UiModuleAiMessage
  readonly module: ResumeModule
  readonly onApplyRows: (rows: ModuleContentRow[]) => void
  readonly setMessages: Dispatch<SetStateAction<UiModuleAiMessage[]>>
  readonly toast: ReturnType<typeof useToast>["toast"]
}

async function requestModuleAi(
  module: ResumeModule,
  messages: readonly UiModuleAiMessage[],
  signal: AbortSignal,
): Promise<ModuleAiResponse> {
  const response = await fetch("/api/ai/module-chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(withStoredAiRequestConfig({ module, messages: messages.map(toApiMessage) })),
    signal,
  })
  const data = parseResponseJson(await response.text())
  if (!response.ok) throw new Error(readErrorMessage(data))
  return data as ModuleAiResponse
}

function resetSession(options: ConversationSetters & { readonly requestRef: MutableRefObject<AbortController | null> }): void {
  options.requestRef.current?.abort()
  options.requestRef.current = null
  options.setMessages([])
  options.setInput("")
  options.setError(null)
  options.setIsLoading(false)
}

function parseResponseJson(text: string): unknown {
  if (!text) throw new Error("服务端没有返回内容")
  return JSON.parse(text) as unknown
}

function readErrorMessage(data: unknown): string {
  if (data && typeof data === "object" && "error" in data) {
    return String((data as { error: unknown }).error)
  }
  return "请求失败"
}

function finishRequest(
  requestRef: MutableRefObject<AbortController | null>,
  controller: AbortController,
  setIsLoading: Dispatch<SetStateAction<boolean>>,
): void {
  if (requestRef.current !== controller) return
  requestRef.current = null
  setIsLoading(false)
}

function createAssistantMessage(response: ModuleAiResponse): UiModuleAiMessage {
  return { id: createMessageId("assistant"), role: "assistant", content: response.reply, changes: response.changes }
}

function createUiMessage(role: ModuleAiMessage["role"], content: string): UiModuleAiMessage {
  return { id: createMessageId(role), role, content }
}

function createMessageId(prefix: string): string {
  const randomPart = Math.random().toString(RANDOM_ID_RADIX).slice(ID_RANDOM_START, ID_RANDOM_END)
  return `${prefix}-${Date.now()}-${randomPart}`
}

function isAbortError(value: unknown): boolean {
  return value instanceof DOMException && value.name === "AbortError"
}

function markApplied(messages: readonly UiModuleAiMessage[], messageId: string): UiModuleAiMessage[] {
  return messages.map((message) => (message.id === messageId ? { ...message, applied: true } : message))
}

function toApiMessage(message: UiModuleAiMessage): ModuleAiMessage {
  return { role: message.role, content: message.content }
}
