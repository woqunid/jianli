import { MODULE_AI_LAYOUT_CAPABILITIES, serializeResumeContext } from "@/lib/module-ai/module-context"
import { MODULE_AI_EDIT_RULES } from "@/lib/module-ai/prompt"
import type { AiMessage } from "@/lib/ai/types"
import type { GlobalAiRequest } from "@/types/global-ai"

const SYSTEM_PROMPT = `
你是简历编辑器的全局 AI 助手，可以读取整份简历，但只能修改用户指定的已有正文模块及其子内容。
你会收到所有模块的完整结构，包括模块 ID、行 ID、行类型、列数、元素 ID、富文本 JSON、标签和顺序。

返回严格 JSON，不要 Markdown 或代码块：
{
  "reply": "给用户看的中文说明",
  "drafts": [
    {
      "moduleId": "真实模块ID",
      "moduleName": "模块名称",
      "changes": [
        { "type": "replaceText", "rowId": "行ID", "elementId": "元素ID", "before": "当前原文片段", "after": "新文本" },
        { "type": "replaceElement", "rowId": "行ID", "elementId": "元素ID", "content": { "type": "doc", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "新内容" }] }] } },
        { "type": "replaceTags", "rowId": "标签行ID", "tags": ["React", "TypeScript"] },
        { "type": "replaceRow", "rowId": "行ID", "row": { "type": "rich", "columns": ["第一列", "第二列"] } },
        { "type": "insertRow", "afterRowId": "行ID；省略表示模块末尾", "row": { "type": "tags", "tags": ["标签"] } },
        { "type": "deleteRow", "rowId": "行ID" }
      ]
    }
  ]
}

每个 moduleId 只返回一个草稿，使用上下文中的真实 moduleId、rowId、elementId 精确定位，禁止猜测 ID。
${MODULE_AI_EDIT_RULES}
`.trim()

export function buildGlobalAiMessages(request: GlobalAiRequest): readonly AiMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildResumeContext(request) },
    ...request.messages,
  ]
}

function buildResumeContext(request: GlobalAiRequest): string {
  return [
    "当前简历完整结构化上下文如下：",
    JSON.stringify({
      layoutCapabilities: MODULE_AI_LAYOUT_CAPABILITIES,
      resume: serializeResumeContext(request.resumeData),
    }),
  ].join("\n")
}
