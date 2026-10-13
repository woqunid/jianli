import { readAiEventStream } from "./event-stream"

export async function readResponsesStream(response: Response, onTextDelta?: (delta: string) => void): Promise<unknown> {
  return readAiEventStream(response, (event) => {
    if (event.type === "response.output_text.delta" && typeof event.delta === "string") onTextDelta?.(event.delta)
    if (event.type === "error") throw new Error(`AI 流式响应失败：${event.message ?? event.code ?? "未知错误"}`)
    const result = event.response as Record<string, unknown> | undefined
    if (event.type === "response.failed") {
      const error = result?.error as { message?: string } | undefined
      throw new Error(`AI 流式响应失败：${error?.message ?? "未知错误"}`)
    }
    if (event.type === "response.incomplete") {
      const details = result?.incomplete_details as { reason?: string } | undefined
      throw new Error(`AI 服务输出不完整：${details?.reason ?? "未知原因"}`)
    }
    if (event.type === "response.completed") {
      if (!result) throw new Error("AI 流式响应缺少完整结果")
      return result
    }
    return undefined
  })
}
