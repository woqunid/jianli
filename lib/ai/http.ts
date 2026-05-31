const JSON_HEADERS = { "content-type": "application/json" } as const;

export class AiProviderError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AiProviderError";
    this.status = status;
  }
}

export async function postJson(
  url: string,
  headers: Readonly<Record<string, string>>,
  body: unknown,
): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { ...JSON_HEADERS, ...headers },
    body: JSON.stringify(body),
  });
  const text = await response.text();

  if (!response.ok) {
    throw new AiProviderError(response.status, text || response.statusText);
  }

  return text ? JSON.parse(text) : {};
}

export function requireString(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`AI provider response missing text at ${path}`);
  }
  return value;
}
