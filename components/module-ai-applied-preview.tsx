"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import { Icon } from "@iconify/react"
import type { ModuleAiChange, ModuleAiRowDraft } from "@/types/module-ai"

interface ModuleAiAppliedPreviewProps {
  readonly applied?: boolean
  readonly changes: readonly ModuleAiChange[]
}

export default function ModuleAiAppliedPreview({ applied = false, changes }: ModuleAiAppliedPreviewProps) {
  const [open, setOpen] = useState(false)
  if (changes.length === 0) return null

  return (
    <div className="mt-3 min-w-0 max-w-full overflow-hidden rounded-md border border-slate-200 bg-white p-3 text-slate-800 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-slate-500"
      >
        <span className="flex items-center gap-1.5">
          <Icon icon={applied ? "mdi:file-check-outline" : "mdi:file-edit-outline"} className="h-3.5 w-3.5 text-primary" />
          {applied ? `已应用 ${changes.length} 项修改` : `待确认 ${changes.length} 项修改`}
        </span>
        <Icon icon={open ? "mdi:chevron-up" : "mdi:chevron-down"} className="h-4 w-4" />
      </button>
      {open ? (
        <div className="mt-2 space-y-2">
          {changes.map((change, index) => (
            <ChangePreview change={change} index={index} key={`${change.type}-${index}`} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ChangePreview({ change, index }: { readonly change: ModuleAiChange; readonly index: number }) {
  if (change.type === "replaceText") {
    return (
      <PreviewFrame title={`${index + 1}. 修改指定列文本`} detail={`行 ${shortId(change.rowId)} / 元素 ${shortId(change.elementId)}`}>
        <div className="line-through opacity-60">{change.before}</div>
        <div className="mt-1 text-emerald-700">{change.after || "（清空内容）"}</div>
      </PreviewFrame>
    )
  }
  if (change.type === "replaceTags") {
    return (
      <PreviewFrame title={`${index + 1}. 更新标签行`} detail={`行 ${shortId(change.rowId)}`}>
        <RowDraftPreview row={{ type: "tags", tags: change.tags }} />
      </PreviewFrame>
    )
  }
  if (change.type === "replaceRow") {
    return (
      <PreviewFrame title={`${index + 1}. 调整整行布局`} detail={`行 ${shortId(change.rowId)}`}>
        <RowDraftPreview row={change.row} />
      </PreviewFrame>
    )
  }
  if (change.type === "insertRow") {
    return (
      <PreviewFrame title={`${index + 1}. 新增一行`} detail={change.afterRowId ? `位于 ${shortId(change.afterRowId)} 之后` : "位于模块末尾"}>
        <RowDraftPreview row={change.row} />
      </PreviewFrame>
    )
  }
  return <PreviewFrame title={`${index + 1}. 删除一行`} detail={`行 ${shortId(change.rowId)}`} />
}

function PreviewFrame({ children, detail, title }: { readonly children?: ReactNode; readonly detail: string; readonly title: string }) {
  return (
    <div className="min-w-0 overflow-hidden rounded border border-slate-200 bg-slate-50 p-2 text-xs">
      <div className="font-medium text-slate-700">{title}</div>
      <div className="mb-1 text-[11px] text-slate-500">{detail}</div>
      {children}
    </div>
  )
}

function RowDraftPreview({ row }: { readonly row: ModuleAiRowDraft }) {
  if (row.type === "tags") {
    return <div className="flex flex-wrap gap-1">{row.tags.map((tag) => <span className="rounded border bg-white px-1.5 py-0.5" key={tag}>{tag}</span>)}</div>
  }
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${row.columns.length}, minmax(0, 1fr))` }}>
      {row.columns.map((column, index) => <div className="break-words rounded bg-white px-2 py-1" key={index}>{column}</div>)}
    </div>
  )
}

function shortId(value: string): string {
  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value
}
