export type AiProvider = "openai" | "anthropic" | "gemini";

export type AiMessageRole = "system" | "user" | "assistant";

export interface AiMessage {
  readonly role: AiMessageRole;
  readonly content: string;
}

export interface AiChatOptions {
  readonly messages: readonly AiMessage[];
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
}

export interface AiConfig {
  readonly provider: AiProvider;
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
}

export interface AiChatResult {
  readonly provider: AiProvider;
  readonly model: string;
  readonly text: string;
}

export interface ProviderRequest {
  readonly config: AiConfig;
  readonly options: AiChatOptions;
}
