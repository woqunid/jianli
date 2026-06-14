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
import type { GlobalAiMessage, GlobalAiResponse, GlobalAiModuleDraft } from "@/types/global-ai"
import type { ResumeData } from "@/types/resume"

export interface UiGlobalAiMessage extends GlobalAiMessage {
  readonly id: string
  readonly drafts?: readonly GlobalAiModuleDraft[]
}

export interface GlobalAiConversationState {
  readonly error: string | null
  readonly input: string
  readonly isLoading: boolean
  readonly messages: readonly UiGlobalAiMessage[]
  readonly open: boolean
}

export interface GlobalAiConversationActions {
  readonly submit: () => void
  readonly updateInput: (value: string) => void
  readonly updateOpen: (open: boolean) => void
}

interface GlobalAiConversationProps {
  readonly resumeData: ResumeData
}

interface ConversationSetters {
  readonly setError: Dispatch<SetStateAction<string | null>>
  readonly setInput: Dispatch<SetStateAction<string>>
  readonly setIsLoading: Dispatch<SetStateAction<boolean>>
  readonly setMessages: Dispatch<SetStateAction<UiGlobalAiMessage[]>>
}

const ID_RANDOM_END = 11
const ID_RANDOM_START = 2
const RANDOM_ID_RADIX = 36

export function useGlobalAiConversation(props: GlobalAiConversationProps): {
  readonly actions: GlobalAiConversationActions
  readonly state: GlobalAiConversationState
} {
  const { toast } = useToast()
  const requestRef = useRef<AbortController | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<UiGlobalAiMessage[]>([])
  const [open, setOpen] = useState(false)

  const updateOpen = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) resetSession({ requestRef, setError, setInput, setIsLoading, setMessages })
  }

  const submit = () => {
    void sendMessage({
      input,
      isLoading,
      messages,
      resumeData: props.resumeData,
      requestRef,
      setError,
      setInput,
      setIsLoading,
      setMessages,
      toast,
    })
  }

  return {
    actions: { submit, updateInput: setInput, updateOpen },
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
    const response = await requestGlobalAi(options.resumeData, nextMessages, controller.signal)
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
  readonly messages: readonly UiGlobalAiMessage[]
  readonly resumeData: ResumeData
  readonly requestRef: MutableRefObject<AbortController | null>
  readonly toast: ReturnType<typeof useToast>["toast"]
}

function handleRequestError(caught: unknown, options: SendMessageOptions): void {
  if (isAbortError(caught)) return
  const message = caught instanceof Error ? caught.message : String(caught)
  options.setError(message)
  options.toast({ title: "AI 对话失败", description: message, variant: "destructive" })
}

async function requestGlobalAi(
  resumeData: ResumeData,
  messages: readonly UiGlobalAiMessage[],
  signal: AbortSignal,
): Promise<GlobalAiResponse> {
  const response = await fetch("/api/ai/global-chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(withStoredAiRequestConfig({ resumeData, messages: messages.map(toApiMessage) })),
    signal,
  })
  const data = parseResponseJson(await response.text())
  if (!response.ok) throw new Error(readErrorMessage(data))
  return data as GlobalAiResponse
}

function resetSession(
  options: ConversationSetters & { readonly requestRef: MutableRefObject<AbortController | null> },
): void {
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

function createAssistantMessage(response: GlobalAiResponse): UiGlobalAiMessage {
  return {
    id: createMessageId("assistant"),
    role: "assistant",
    content: response.reply,
    drafts: response.drafts,
  }
}

function createUiMessage(role: GlobalAiMessage["role"], content: string): UiGlobalAiMessage {
  return { id: createMessageId(role), role, content }
}

function createMessageId(prefix: string): string {
  const randomPart = Math.random().toString(RANDOM_ID_RADIX).slice(ID_RANDOM_START, ID_RANDOM_END)
  return `${prefix}-${Date.now()}-${randomPart}`
}

function isAbortError(value: unknown): boolean {
  return value instanceof DOMException && value.name === "AbortError"
}

function toApiMessage(message: UiGlobalAiMessage): GlobalAiMessage {
  return { role: message.role, content: message.content }
}
