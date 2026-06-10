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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { loadAiClientConfig, saveAiClientConfig } from "@/lib/ai/client-config-storage"
import {
  DEFAULT_AI_CLIENT_CONFIG,
  type AiClientConfig,
  type AiClientProvider,
  type AiConfigMode,
} from "@/types/ai-config"
import { Icon } from "@iconify/react"

const PROVIDER_LABELS: Readonly<Record<AiClientProvider, string>> = {
  openai: "OpenAI",
  gemini: "Gemini",
  anthropic: "Anthropic",
}

const PROVIDER_PLACEHOLDERS: Readonly<Record<AiClientProvider, { readonly baseUrl: string; readonly model: string }>> = {
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.5-flash" },
  anthropic: { baseUrl: "https://api.anthropic.com/v1", model: "claude-3-5-haiku-latest" },
}

const CUSTOM_FIELDS_CLASS =
  "space-y-4 rounded-md border-2 border-slate-300 bg-slate-50/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_18px_rgba(15,23,42,0.08)]"

const FIELD_CONTROL_CLASS =
  "border-2 border-slate-300 bg-white text-slate-900 shadow-[inset_0_1px_3px_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.06)] placeholder:text-slate-400 focus-visible:border-emerald-600 focus-visible:ring-emerald-600/20"

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
          {draft.mode === "custom" ? <CustomFields config={draft} onChange={update} /> : null}
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

function CustomFields({
  config,
  onChange,
}: {
  readonly config: AiClientConfig
  readonly onChange: (patch: Partial<AiClientConfig>) => void
}) {
  const placeholders = PROVIDER_PLACEHOLDERS[config.provider]
  return (
    <div className={CUSTOM_FIELDS_CLASS}>
      <ProviderSelect provider={config.provider} onChange={(provider) => onChange({ provider })} />
      <TextField
        id="ai-config-api-key"
        label="API Key"
        placeholder="请输入 API Key"
        type="password"
        value={config.apiKey}
        onChange={(apiKey) => onChange({ apiKey })}
      />
      <TextField
        id="ai-config-base-url"
        label="Base URL"
        placeholder={placeholders.baseUrl}
        value={config.baseUrl}
        onChange={(baseUrl) => onChange({ baseUrl })}
      />
      <TextField
        id="ai-config-model"
        label="模型"
        placeholder={placeholders.model}
        value={config.model}
        onChange={(model) => onChange({ model })}
      />
    </div>
  )
}

function ProviderSelect({
  provider,
  onChange,
}: {
  readonly provider: AiClientProvider
  readonly onChange: (provider: AiClientProvider) => void
}) {
  return (
    <div className="space-y-2">
      <Label>请求格式</Label>
      <Select value={provider} onValueChange={(value) => onChange(value as AiClientProvider)}>
        <SelectTrigger className={`${FIELD_CONTROL_CLASS} min-h-11 w-full`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function TextField({
  id,
  label,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  readonly id: string
  readonly label: string
  readonly onChange: (value: string) => void
  readonly placeholder?: string
  readonly type?: string
  readonly value: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className={`h-11 ${FIELD_CONTROL_CLASS}`}
        placeholder={placeholder}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function readSavedDescription(config: AiClientConfig): string {
  if (config.mode === "default") return "当前使用默认 API Key"
  return `当前使用 ${PROVIDER_LABELS[config.provider]}`
}
