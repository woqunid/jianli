"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { AiResumeAction, AiResumeSection } from "@/types/ai-resume"

interface AiJdDialogProps {
  readonly action: AiResumeAction
  readonly extraInfo: string
  readonly jobDescription: string
  readonly sections: readonly AiResumeSection[]
  readonly targetRole: string
  readonly onActionChange: (action: AiResumeAction) => void
  readonly onExtraInfoChange: (value: string) => void
  readonly onJobDescriptionChange: (value: string) => void
  readonly onSectionsChange: (sections: readonly AiResumeSection[]) => void
  readonly onTargetRoleChange: (value: string) => void
}

const SECTION_OPTIONS: readonly { value: AiResumeSection; label: string }[] = [
  { value: "jobIntention", label: "求职意向" },
  { value: "skills", label: "专业技能" },
  { value: "experience", label: "工作经历" },
  { value: "projects", label: "项目经历" },
  { value: "summary", label: "个人总结" },
  { value: "proofread", label: "全文纠错" },
  { value: "jdAnalysis", label: "JD 匹配度分析" },
]

const ACTION_OPTIONS: readonly { value: AiResumeAction; label: string }[] = [
  { value: "analyze", label: "分析匹配度" },
  { value: "optimize", label: "优化现有内容" },
  { value: "generate", label: "生成候选内容" },
]

export default function AiJdDialog(props: AiJdDialogProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="ai-target-role">目标岗位名称</Label>
        <Input
          id="ai-target-role"
          value={props.targetRole}
          onChange={(event) => props.onTargetRoleChange(event.target.value)}
          placeholder="如：前端开发工程师"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-jd">Job Description</Label>
        <Textarea
          id="ai-jd"
          value={props.jobDescription}
          onChange={(event) => props.onJobDescriptionChange(event.target.value)}
          placeholder="粘贴目标岗位 JD 原文"
          className="min-h-36 resize-y"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-extra-info">用户补充信息</Label>
        <Textarea
          id="ai-extra-info"
          value={props.extraInfo}
          onChange={(event) => props.onExtraInfoChange(event.target.value)}
          placeholder="例如：我主要负责 React 页面开发、简历导出、PDF 生成优化；项目日活约 200 人；不要编造管理经验。"
          className="min-h-24 resize-y"
        />
      </div>

      <div className="space-y-2">
        <Label>优化范围</Label>
        <div className="grid grid-cols-2 gap-2">
          {SECTION_OPTIONS.map((option) => (
            <SectionCheckbox key={option.value} option={option} {...props} />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>操作类型</Label>
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted p-1">
          {ACTION_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={props.action === option.value ? "default" : "ghost"}
              onClick={() => props.onActionChange(option.value)}
              className="h-8"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

function SectionCheckbox({
  option,
  sections,
  onSectionsChange,
}: AiJdDialogProps & { readonly option: { value: AiResumeSection; label: string } }) {
  const checked = sections.includes(option.value)
  const nextSections = (enabled: boolean) => {
    if (enabled) return [...sections, option.value]
    return sections.filter((section) => section !== option.value)
  }
  return (
    <label className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onSectionsChange(nextSections(event.target.checked))}
        className="h-4 w-4 accent-primary"
      />
      <span>{option.label}</span>
    </label>
  )
}
