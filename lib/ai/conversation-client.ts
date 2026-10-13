import { withStoredAiRequestConfig } from "./client-config-storage"
import { readAiEventStream } from "./event-stream"

export async function requestAiConversation<T>(
  url: string,
  body: unknown,
  signal: AbortSignal,
  onReply: (reply: string) => void,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(withStoredAiRequestConfig(body)),
    signal,
  })
  return readAiConversation<T>(response, onReply)
}

export async function readAiConversation<T>(response: Response, onReply: (reply: string) => void): Promise<T> {
  if (!response.ok) {
    const data = await response.json() as { error?: string }
    throw new Error(data.error ?? "请求失败")
  }
  let text = ""
  let lastReply = ""
  return readAiEventStream<T>(response, (event) => {
    if (event.type === "error") throw new Error(String(event.error))
    if (event.type === "result") return event.result as T
    if (event.type === "delta" && typeof event.delta === "string") {
      text += event.delta
      const reply = readPartialReply(text)
      if (reply !== lastReply) {
        lastReply = reply
        onReply(reply)
      }
    }
    return undefined
  })
}

function readPartialReply(text: string): string {
  const match = /"reply"\s*:\s*"/.exec(text)
  if (!match) return ""
  let result = ""
  for (let index = match.index + match[0].length; index < text.length; index += 1) {
    const character = text[index]
    if (character === '"') break
    if (character !== "\\") {
      result += character
      continue
    }
    const escaped = text[++index]
    if (!escaped) break
    if (escaped === "u") {
      const hex = text.slice(index + 1, index + 5)
      if (!/^[\da-f]{4}$/i.test(hex)) break
      result += String.fromCharCode(parseInt(hex, 16))
      index += 4
    } else {
      const escapes: Record<string, string> = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" }
      if (!(escaped in escapes)) break
      result += escapes[escaped]
    }
  }
  return result
}
