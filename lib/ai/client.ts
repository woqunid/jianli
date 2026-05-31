import { loadAiConfig } from "./config";
import { callAnthropic, callGemini, callOpenAi } from "./providers";
import type { AiChatOptions, AiChatResult } from "./types";

export async function createAiChatCompletion(options: AiChatOptions): Promise<AiChatResult> {
  const config = loadAiConfig(options.model);
  const request = { config, options };

  if (config.provider === "openai") {
    return callOpenAi(request);
  }
  if (config.provider === "anthropic") {
    return callAnthropic(request);
  }
  return callGemini(request);
}
