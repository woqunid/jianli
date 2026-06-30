"use client"

import { useState } from "react"
import type { ModuleAiRowDraft } from "@/types/module-ai"
import { Icon } from "@iconify/react"

interface ModuleAiAppliedPreviewProps {
  readonly applied?: boolean
  readonly rows: readonly ModuleAiRowDraft[]
}

export default function ModuleAiAppliedPreview({ applied = false, rows }: ModuleAiAppliedPreviewProps) {
  const [open, setOpen] = useState(false)
  if (rows.length === 0) return null

  return (
    <div className="mt-3 min-w-0 max-w-full overflow-hidden rounded-md border border-slate-200 bg-white p-3 text-slate-800 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-slate-500"
      >
        <span className="flex items-center gap-1.5">
          <Icon icon={applied ? "mdi:file-check-outline" : "mdi:file-edit-outline"} className="h-3.5 w-3.5 text-primary" />
          {applied ? "已应用内容" : "AI 修改内容"}
        </span>
        <Icon icon={open ? "mdi:chevron-up" : "mdi:chevron-down"} className="h-4 w-4" />
      </button>
      {open ? <AppliedRows rows={rows} /> : null}
    </div>
  )
}

function AppliedRows({ rows }: { readonly rows: readonly ModuleAiRowDraft[] }) {
  return (
    <div className="mt-2 space-y-2">
      {rows.map((row, index) => (
        <AppliedRow key={readRowKey(row, index)} index={index} row={row} />
      ))}
    </div>
  )
}

function AppliedRow({ index, row }: { readonly index: number; readonly row: ModuleAiRowDraft }) {
  if (row.type === "tags") {
    return <TagsRow index={index} tags={row.tags} />
  }
  return <RichRow columns={row.columns} index={index} />
}

function RichRow({ columns, index }: { readonly columns: readonly string[]; readonly index: number }) {
  return (
    <div className="min-w-0 overflow-hidden rounded border border-slate-200 bg-slate-50 p-2">
      <div className="mb-1 text-[11px] text-slate-500">
        第 {index + 1} 行 / {columns.length} 列
      </div>
      <div className="grid min-w-0 gap-1 text-xs" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((column, columnIndex) => (
          <div
            key={`${index}-${columnIndex}`}
            className="min-w-0 whitespace-pre-wrap break-words rounded bg-white px-2 py-1 leading-relaxed text-slate-800 [overflow-wrap:anywhere]"
          >
            {column}
          </div>
        ))}
      </div>
    </div>
  )
}

function TagsRow({ index, tags }: { readonly index: number; readonly tags: readonly string[] }) {
  return (
    <div className="min-w-0 overflow-hidden rounded border border-slate-200 bg-slate-50 p-2">
      <div className="mb-1 text-[11px] text-slate-500">第 {index + 1} 行 / 标签</div>
      <div className="flex flex-wrap gap-1">
        {tags.map((tag, tagIndex) => (
          <span
            key={`${tag}-${tagIndex}`}
            className="max-w-full break-words rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-800 [overflow-wrap:anywhere]"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

function readRowKey(row: ModuleAiRowDraft, index: number): string {
  if (row.type === "tags") return `tags-${index}-${row.tags.join("-")}`
  return `rich-${index}-${row.columns.join("-")}`
}
