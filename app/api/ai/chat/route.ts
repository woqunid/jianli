import { NextResponse } from "next/server";
import { AiProviderError } from "@/lib/ai/http";
import { createAiChatCompletion } from "@/lib/ai/client";
import type { AiChatOptions, AiMessage } from "@/lib/ai/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HTTP_STATUS_INTERNAL_ERROR = 500;

function isMessage(value: unknown): value is AiMessage {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Record<string, unknown>;
  return ["system", "user", "assistant"].includes(String(item.role)) && typeof item.content === "string";
}

function parseOptions(body: unknown): AiChatOptions {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object");
  }
  const input = body as Record<string, unknown>;
  if (!Array.isArray(input.messages) || !input.messages.every(isMessage)) {
    throw new Error("messages must be an array of { role, content }");
  }
  if (input.messages.length === 0) {
    throw new Error("messages must contain at least one item");
  }
  return {
    messages: input.messages,
    model: typeof input.model === "string" ? input.model : undefined,
    temperature: readOptionalNumber(input.temperature, "temperature"),
    maxTokens: readOptionalNumber(input.maxTokens, "maxTokens"),
  };
}

function readOptionalNumber(value: unknown, name: string): number | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
  return value;
}

export async function POST(req: Request) {
  try {
    const options = parseOptions(await req.json());
    const result = await createAiChatCompletion(options);
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof AiProviderError ? error.status : HTTP_STATUS_INTERNAL_ERROR;
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status });
  }
}
