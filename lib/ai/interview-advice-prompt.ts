import type { AiMessage } from "@/lib/ai/types"
import type { ResumeSummary } from "@/lib/ai/resume-summary"

const INTERVIEW_RESPONSE_SCHEMA = {
  overview: "基于整份简历得到的面试准备总览",
  workNature: "根据简历和目标岗位判断出的工作性质、核心职责和面试关注点",
  adviceSections: [
    {
      title: "准备主题",
      focus: "这一主题为什么重要",
      items: [
        {
          title: "准备项",
          detail: "结合简历说明需要准备什么、为什么准备、面试中如何表达",
          actions: ["可执行准备动作"],
        },
      ],
    },
  ],
  selfIntroduction: {
    content: "一段可直接用于面试开场的自我介绍，只能基于简历事实总结",
    keyPoints: ["自我介绍中应强调的简历依据"],
  },
  questions: [
    {
      category: "问题类型",
      question: "基于简历可能被问到的问题",
      answer: "结合简历内容给出的参考答案",
      resumeBasis: "这个问题来自简历中的哪类信息",
    },
  ],
}

const SYSTEM_PROMPT = `
你是专业中文面试准备教练。
你必须读取并分析用户提供的整份简历摘要，生成面试准备建议和可能面试问题。
内容必须全方面适配工作性质，不要只围绕技术；即使是技术岗位，也要覆盖业务理解、职责边界、协作沟通、项目表达、成果证明和行为面试。
如果简历呈现的是产品、运营、销售、设计、行政、人力、财务、教育、医疗、管理或其他非技术方向，必须按对应岗位性质生成建议。
不得编造简历中不存在的公司、学校、项目、经历、数据、证书、职责或成果。
自我介绍必须只使用简历已有事实；信息不足时写成【待补充：具体内容】。
参考答案必须结合简历内容组织，不要给空泛模板。
面试建议应覆盖知识/技能复盘、业务与岗位理解、经历讲述、成果证据、短板应对、沟通协作、行为面试、材料准备和表达策略。
问题列表必须先围绕自我介绍之外的简历高频追问展开，再覆盖经历、项目、技能/方法、工作方式、稳定性和职业动机。
必须且仅返回一个严格合法的 JSON 对象；第一个字符必须是 {，最后一个非空字符必须是 }。
顶层字段固定为：overview、workNature、adviceSections、selfIntroduction、questions。
不要输出 Markdown、代码块、解释文本、标题或寒暄。`

export function buildInterviewAdvicePrompt(summary: ResumeSummary): readonly AiMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(summary) },
  ]
}

function buildUserPrompt(summary: ResumeSummary): string {
  return [
    `目标岗位（来自简历求职意向）：${summary.targetRole || "未填写"}`,
    "当前简历摘要：",
    JSON.stringify(summary, null, 2),
    "返回 JSON schema：",
    JSON.stringify(INTERVIEW_RESPONSE_SCHEMA, null, 2),
    "生成要求：",
    [
      "面试建议至少覆盖 6 个不同准备主题，每个主题给出可执行准备动作。",
      "可能性面试问题中必须先生成 selfIntroduction，再生成问题和答案。",
      "questions 建议不少于 10 个，问题必须来自简历中的教育、工作、项目、技能、求职意向或个人经历线索。",
      "答案必须像候选人本人会说的话，避免泛泛而谈。",
    ].join("\n"),
    "现在只返回本次面试建议的 JSON 对象，不要复述 schema。",
  ].join("\n\n")
}
