"use client"

import { useEffect, useState } from "react"
import { Icon } from "@iconify/react"
import { Button } from "@/components/ui/button"
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
import type { AiClientConfig, AiClientProvider } from "@/types/ai-config"

export const PROVIDER_LABELS: Readonly<Record<AiClientProvider, string>> = {
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

interface AiConfigFieldsProps {
  readonly config: AiClientConfig
  readonly onChange: (patch: Partial<AiClientConfig>) => void
}

export function AiConfigFields({ config, onChange }: AiConfigFieldsProps) {
  const modelList = useAiModelList(config)
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
      <ModelField
        loading={modelList.loading}
        models={modelList.models}
        placeholder={placeholders.model}
        value={config.model}
        onChange={(model) => onChange({ model })}
        onFetch={modelList.fetch}
      />
    </div>
  )
}

function useAiModelList(config: AiClientConfig) {
  const { toast } = useToast()
  const [models, setModels] = useState<readonly string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setModels([])
  }, [config.provider, config.apiKey, config.baseUrl])

  const fetch = async () => {
    try {
      setLoading(true)
      const nextModels = await requestModels(config)
      if (nextModels.length === 0) throw new Error("接口没有返回可用模型")
      setModels(nextModels)
      toast({ title: "模型列表已获取", description: `共获取 ${nextModels.length} 个模型` })
    } catch (error) {
      toast({
        title: "获取模型失败",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return { fetch, loading, models }
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

function ModelField({
  loading,
  models,
  onChange,
  onFetch,
  placeholder,
  value,
}: {
  readonly loading: boolean
  readonly models: readonly string[]
  readonly onChange: (value: string) => void
  readonly onFetch: () => void
  readonly placeholder: string
  readonly value: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="ai-config-model">模型</Label>
        <Button type="button" variant="outline" size="sm" className="gap-2" disabled={loading} onClick={onFetch}>
          <Icon icon={loading ? "mdi:loading" : "mdi:cloud-search-outline"} className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {loading ? "获取中" : "获取模型"}
        </Button>
      </div>
      {models.length > 0 ? (
        <ModelSelect models={models} value={value} onChange={onChange} />
      ) : (
        <Input
          id="ai-config-model"
          className={`h-11 ${FIELD_CONTROL_CLASS}`}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  )
}

function ModelSelect({
  models,
  onChange,
  value,
}: {
  readonly models: readonly string[]
  readonly onChange: (value: string) => void
  readonly value: string
}) {
  const options = includeCurrentModel(models, value)
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id="ai-config-model" className={`${FIELD_CONTROL_CLASS} min-h-11 w-full`}>
        <SelectValue placeholder="请选择模型" />
      </SelectTrigger>
      <SelectContent>
        {options.map((model) => (
          <SelectItem key={model} value={model}>
            {model}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function includeCurrentModel(models: readonly string[], value: string): readonly string[] {
  const current = value.trim()
  if (!current || models.includes(current)) return models
  return [current, ...models]
}

async function requestModels(config: AiClientConfig): Promise<readonly string[]> {
  const response = await fetch("/api/ai/models", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: config.provider,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    }),
  })
  const body = parseLocalModelResponse(await response.text())
  if (!response.ok) throw new Error(readErrorMessage(body))
  return readModels(body)
}

function parseLocalModelResponse(text: string): unknown {
  if (!text.trim()) throw new Error("模型列表接口没有返回内容")
  try {
    return JSON.parse(text) as unknown
  } catch {
    if (looksLikeHtml(text)) {
      throw new Error("模型列表接口返回了 HTML 页面。请确认本地服务正常、登录状态有效，并且 /api/ai/models 路由没有被页面重定向。")
    }
    throw new Error("模型列表接口响应不是合法 JSON")
  }
}

function readModels(value: unknown): readonly string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("模型列表接口响应必须是 JSON 对象")
  }
  const models = (value as Record<string, unknown>).models
  if (!Array.isArray(models) || !models.every((item) => typeof item === "string")) {
    throw new Error("模型列表接口响应缺少 models 字符串数组")
  }
  return models
}

function readErrorMessage(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "模型列表请求失败"
  const message = (value as Record<string, unknown>).error
  return typeof message === "string" && message.trim() ? message : "模型列表请求失败"
}

function looksLikeHtml(text: string): boolean {
  return /^\s*(<!doctype|<html|<body|<head)\b/i.test(text)
}
