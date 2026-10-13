const JSON_HEADERS = { "content-type": "application/json" } as const;

export class AiProviderError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AiProviderError";
    this.status = status;
  }
}

export async function postResponse(
  url: string,
  headers: Readonly<Record<string, string>>,
  body: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  const response = await fetch(url, {
    method: "POST",
    headers: { ...JSON_HEADERS, ...headers },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new AiProviderError(response.status, `AI 服务请求失败（状态码 ${response.status}）：${text || response.statusText}`);
  }
  return response;
}

export async function postJson(
  url: string,
  headers: Readonly<Record<string, string>>,
  body: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await postResponse(url, headers, body, signal);
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("AI 服务响应不是合法 JSON");
  }
}

export function requireString(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`AI 服务响应缺少文本字段：${path}`);
  }
  return value;
}
