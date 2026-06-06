export async function requestJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = parseResponseJson(await response.text())
  if (!response.ok) throw new Error(readErrorMessage(data))
  return data as T
}

function parseResponseJson(text: string): unknown {
  if (!text) throw new Error("服务端没有返回内容")
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error(`服务端返回内容不是合法 JSON：${text}`)
  }
}

function readErrorMessage(data: unknown): string {
  if (data && typeof data === "object" && "error" in data) {
    return String((data as { error: unknown }).error)
  }
  return "请求失败"
}
