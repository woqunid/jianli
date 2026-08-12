import { serializeModuleContext } from "@/lib/module-ai/module-context"
import type { AiMessage } from "@/lib/ai/types"
import type { GlobalAiRequest } from "@/types/global-ai"

const SYSTEM_PROMPT = `
你是简历编辑器的全局 AI 助手，可以读取并修改整份简历中的任意简历模块和子内容。
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
        { "type": "replaceTags", "rowId": "标签行ID", "tags": ["React", "TypeScript"] },
        { "type": "replaceRow", "rowId": "行ID", "row": { "type": "rich", "columns": ["第一列", "第二列"] } },
        { "type": "insertRow", "afterRowId": "行ID；省略表示模块末尾", "row": { "type": "tags", "tags": ["标签"] } },
        { "type": "deleteRow", "rowId": "行ID" }
      ]
    }
  ]
}

修改规则：
- 通过 moduleId、rowId、elementId 精确定位；禁止根据猜测生成 ID。
- 用户未指定的模块、行和元素不要返回修改。
- 默认使用 replaceText，只替换目标文本并保留原行列布局、顺序、富文本格式和对齐。
- 只有用户明确要求改变单列/多列、分行、合并、增加、删除或标签布局时，才使用结构变更。
- rich 行只能包含 1 到 4 个非空列；技能类内容可用 tags 行。
- 用户要求自动排版时，可以根据模块语义选择单列、2-4 列、标签和分行方式。
- 信息不足时 drafts 返回 [] 并追问；禁止编造事实。
- 咨询和分析请求只返回 reply，drafts 返回 []。
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
      title: request.resumeData.title,
      jobIntention: request.resumeData.jobIntentionSection ?? null,
      personalInfo: request.resumeData.personalInfoSection,
      modules: request.resumeData.modules.map(serializeModuleContext),
    }),
  ].join("\n")
}
