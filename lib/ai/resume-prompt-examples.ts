export const ANALYZE_RESPONSE_EXAMPLE = {
  summary: "当前简历与前端工程师岗位整体匹配度较高，但性能优化和工程化证据不足。",
  matchScore: 82,
  matchedKeywords: ["React", "Next.js", "TypeScript"],
  missingKeywords: ["性能优化", "工程化"],
  improvementDirections: [
    "补充可验证的性能优化场景，例如首屏加载、构建速度或包体积变化。",
    "补充工程化实践证据，例如组件规范、CI、质量门禁或监控建设。",
  ],
}

export const OPTIMIZE_RESPONSE_EXAMPLE = {
  summary: "建议强化项目经历中与 JD 对齐的技术栈、职责和结果表达。",
  matchedKeywords: ["React", "TypeScript"],
  missingKeywords: ["性能优化"],
  suggestions: [
    {
      target: {
        type: "moduleElement",
        moduleId: "project-module-id",
        rowId: "project-row-id",
        elementId: "project-element-id",
        field: "content",
      },
      section: "projects",
      title: "强化项目结果表达",
      before: "负责后台管理系统页面开发，完成表格、表单和权限配置。",
      after: "负责后台管理系统核心页面开发，基于 React 和 TypeScript 完成表格、表单与权限配置；性能优化数据需要用户补充。",
      reason: "原文已有 React 和 TypeScript 相关职责，但缺少 JD 要求的性能优化指标，不能编造数据。",
    },
  ],
}

export const GENERATE_RESPONSE_EXAMPLE = {
  summary: "基于 JD 和用户补充信息生成候选模块内容，缺失真实经历的部分已标注需要用户补充。",
  matchedKeywords: ["Next.js", "组件化", "工程化"],
  missingKeywords: ["性能指标"],
  generatedSections: [
    {
      section: "skills",
      title: "专业技能",
      content: "熟悉 Next.js、React、TypeScript 与组件化开发；性能指标需要用户补充。",
    },
    {
      section: "experience",
      title: "工作经历",
      content: "需要用户补充：真实公司、岗位职责、业务场景和可验证成果。",
    },
    {
      section: "projects",
      title: "项目经历",
      content: "需要用户补充：真实项目名称、个人职责、技术难点和结果指标。",
    },
    {
      section: "careerSkills",
      title: "职业技能",
      content: "具备前端工程化、跨团队沟通和问题定位能力；具体案例需要用户补充。",
    },
  ],
  suggestions: [
    {
      target: {
        type: "moduleContent",
        moduleId: "skills-module-id",
        field: "content",
      },
      section: "skills",
      title: "专业技能候选内容",
      before: "",
      after: "熟悉 Next.js、React、TypeScript 与组件化开发；性能指标需要用户补充。",
      reason: "内容来自 JD 和用户补充信息；没有真实指标时明确要求用户补充。",
    },
  ],
}
