"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { AiConfigFields, PROVIDER_LABELS } from "@/components/ai-config-fields"
import { useToast } from "@/hooks/use-toast"
import { loadAiClientConfig, saveAiClientConfig } from "@/lib/ai/client-config-storage"
import {
  DEFAULT_AI_CLIENT_CONFIG,
  type AiClientConfig,
  type AiConfigMode,
} from "@/types/ai-config"
import { Icon } from "@iconify/react"

export default function AiConfigDialog() {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<AiClientConfig>(DEFAULT_AI_CLIENT_CONFIG)

  useEffect(() => {
    try {
      setDraft(loadAiClientConfig())
    } catch (error) {
      toast({
        title: "AI 配置读取失败",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      })
    }
  }, [toast])

  const update = (patch: Partial<AiClientConfig>) => {
    setDraft((current) => ({ ...current, ...patch }))
  }

  const save = () => {
    try {
      const saved = saveAiClientConfig(draft)
      setDraft(saved)
      setOpen(false)
      toast({ title: "AI 配置已保存", description: readSavedDescription(saved) })
    } catch (error) {
      toast({
        title: "AI 配置保存失败",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 bg-transparent">
          <Icon icon="mdi:tune-variant" className="h-4 w-4" />
          AI配置
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>AI配置</DialogTitle>
          <DialogDescription>选择 AI 请求使用的配置来源。</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <ModeSelector mode={draft.mode} onChange={(mode) => update({ mode })} />
          {draft.mode === "custom" ? <AiConfigFields config={draft} onChange={update} /> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => update(DEFAULT_AI_CLIENT_CONFIG)}>
            恢复默认
          </Button>
          <Button onClick={save} className="gap-2">
            <Icon icon="mdi:content-save-outline" className="h-4 w-4" />
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ModeSelector({
  mode,
  onChange,
}: {
  readonly mode: AiConfigMode
  readonly onChange: (mode: AiConfigMode) => void
}) {
  return (
    <div className="space-y-3">
      <Label>配置来源</Label>
      <div role="radiogroup" className="grid gap-3">
        <ModeItem checked={mode === "default"} label="使用默认 API Key" value="default" onChange={onChange} />
        <ModeItem checked={mode === "custom"} label="自己配置 API Key" value="custom" onChange={onChange} />
      </div>
    </div>
  )
}

function ModeItem({
  checked,
  label,
  onChange,
  value,
}: {
  readonly checked: boolean
  readonly label: string
  readonly onChange: (mode: AiConfigMode) => void
  readonly value: AiConfigMode
}) {
  const id = `ai-config-${value}`
  return (
    <Label htmlFor={id} className="flex items-center gap-2 rounded-md border p-3 font-normal">
      <input
        id={id}
        type="radio"
        name="ai-config-mode"
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="h-4 w-4"
      />
      <span>
        {label}
      </span>
    </Label>
  )
}

function readSavedDescription(config: AiClientConfig): string {
  if (config.mode === "default") return "当前使用默认 API Key"
  return `当前使用 ${PROVIDER_LABELS[config.provider]}`
}
