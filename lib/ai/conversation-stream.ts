import { AiProviderError } from "./http"

interface StreamOptions {
  readonly signal: AbortSignal
  readonly onTextDelta: (delta: string) => void
}

export function createConversationStream<T>(
  requestSignal: AbortSignal,
  generate: (options: StreamOptions) => Promise<T>,
): Response {
  const controller = new AbortController()
  const signal = AbortSignal.any([requestSignal, controller.signal])
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(output) {
      const send = (event: unknown) => {
        if (!signal.aborted) output.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }
      output.enqueue(encoder.encode(": connected\n\n"))
      try {
        const result = await generate({ signal, onTextDelta: (delta) => send({ type: "delta", delta }) })
        send({ type: "result", result })
      } catch (error) {
        send({
          type: "error",
          error: error instanceof Error ? error.message : String(error),
          status: error instanceof AiProviderError ? error.status : 500,
        })
      } finally {
        if (!signal.aborted) output.close()
      }
    },
    cancel() { controller.abort() },
  })
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  })
}
