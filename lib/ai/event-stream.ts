export async function readAiEventStream<T>(
  response: Response,
  onEvent: (event: Record<string, unknown>) => T | undefined,
): Promise<T> {
  if (!response.body) throw new Error("AI 流式响应没有内容")
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  const readPacket = (packet: string): T | undefined => {
    const data = packet.split("\n").filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart()).join("\n")
    if (!data || data === "[DONE]") return undefined
    const event: unknown = JSON.parse(data)
    if (!event || typeof event !== "object" || Array.isArray(event)) throw new Error("AI 流式事件必须是 JSON 对象")
    return onEvent(event as Record<string, unknown>)
  }
  try {
    while (true) {
      const chunk = await reader.read()
      buffer += decoder.decode(chunk.value, { stream: !chunk.done })
      buffer = buffer.replace(/\r\n/g, "\n")
      let boundary: number
      while ((boundary = buffer.indexOf("\n\n")) >= 0) {
        const packet = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const result = readPacket(packet)
        if (result !== undefined) return result
      }
      if (chunk.done) {
        const result = readPacket(buffer)
        if (result !== undefined) return result
        throw new Error("AI 流式响应提前结束，未收到完整结果")
      }
    }
  } finally {
    await reader.cancel()
    reader.releaseLock()
  }
}
