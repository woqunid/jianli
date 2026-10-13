import { FONT_FAMILIES, FONT_SIZES, TEXT_ALIGNMENTS } from "@/lib/rich-text-options"
import type { JSONContent } from "@/types/resume"

const BLOCK_TYPES = ["paragraph", "bulletList", "orderedList"]
const INLINE_TYPES = ["text", "hardBreak"]
const SIMPLE_MARKS = ["bold", "italic", "underline", "strike", "code"]

export function createModuleAiContent(value: string | JSONContent): JSONContent {
  if (typeof value !== "string") return structuredClone(value)
  return {
    type: "doc",
    content: value.split(/\r?\n/).map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  }
}

export function readModuleAiContent(value: unknown, path: string): JSONContent {
  return readNode(value, path, ["doc"])
}

function readNode(value: unknown, path: string, allowedTypes: readonly string[]): JSONContent {
  const node = readRecord(value, path)
  const type = readString(node.type, `${path}.type`)
  if (!allowedTypes.includes(type)) throw new Error(`${path} 不支持富文本节点：${type}`)

  if (type === "text") {
    return {
      type,
      text: readString(node.text, `${path}.text`),
      ...(node.marks ? { marks: readMarks(node.marks, `${path}.marks`) } : {}),
    }
  }
  if (type === "hardBreak") return { type }

  const children = node.content ?? []
  if (!Array.isArray(children)) throw new Error(`${path}.content 必须是数组`)
  const childTypes = type === "paragraph" ? INLINE_TYPES : type.endsWith("List") ? ["listItem"] : BLOCK_TYPES
  const content = children.map((child, index) => readNode(child, `${path}.content[${index}]`, childTypes))
  if (type !== "paragraph" && content.length === 0) throw new Error(`${path} 必须包含内容节点`)
  if (type === "listItem" && content[0].type !== "paragraph") {
    throw new Error(`${path} 的首个节点必须是 paragraph`)
  }

  const attrs: Record<string, unknown> = {}
  if (node.attrs) {
    const input = readRecord(node.attrs, `${path}.attrs`)
    if (type === "paragraph" && input.textAlign != null) {
      const alignment = readString(input.textAlign, `${path}.attrs.textAlign`)
      if (!(TEXT_ALIGNMENTS as readonly string[]).includes(alignment)) throw new Error(`${path} 不支持对齐方式：${alignment}`)
      attrs.textAlign = alignment
    }
    if (type === "orderedList" && input.start != null) {
      if (typeof input.start !== "number" || !Number.isInteger(input.start) || input.start < 1) {
        throw new Error(`${path}.attrs.start 必须是正整数`)
      }
      attrs.start = input.start
    }
  }
  return { type, ...(Object.keys(attrs).length ? { attrs } : {}), content }
}

function readMarks(value: unknown, path: string): NonNullable<JSONContent["marks"]> {
  if (!Array.isArray(value)) throw new Error(`${path} 必须是数组`)
  return value.map((value, index) => {
    const markPath = `${path}[${index}]`
    const mark = readRecord(value, markPath)
    const type = readString(mark.type, `${markPath}.type`)
    if (SIMPLE_MARKS.includes(type)) return { type }
    if (type !== "textStyle" && type !== "link") throw new Error(`${markPath} 不支持文字样式：${type}`)
    const input = readRecord(mark.attrs, `${markPath}.attrs`)
    if (type === "textStyle") {
      const attrs: Record<string, string> = {}
      if (input.fontFamily != null) {
        const font = readString(input.fontFamily, `${markPath}.attrs.fontFamily`)
        if (!FONT_FAMILIES.some((item) => item.value === font)) throw new Error(`${markPath} 不支持字体：${font}`)
        attrs.fontFamily = font
      }
      if (input.fontSize != null) {
        const size = readString(input.fontSize, `${markPath}.attrs.fontSize`)
        if (!FONT_SIZES.some((item) => `${item}pt` === size)) throw new Error(`${markPath} 不支持字号：${size}`)
        attrs.fontSize = size
      }
      if (input.color != null) {
        const color = readString(input.color, `${markPath}.attrs.color`)
        if (!/^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(color)) throw new Error(`${markPath} 颜色必须是十六进制颜色`)
        attrs.color = color
      }
      return { type, attrs }
    }
    if (type === "link") {
      const href = readString(input.href, `${markPath}.attrs.href`)
      if (!/^(https?:\/\/|mailto:|tel:)/i.test(href)) throw new Error(`${markPath} 不支持链接协议`)
      return { type, attrs: { href } }
    }
    throw new Error(`${markPath} 不支持文字样式：${type}`)
  })
}

function readRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path} 必须是 JSON 对象`)
  return value as Record<string, unknown>
}

function readString(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.length) throw new Error(`${path} 必须是非空字符串`)
  return value
}
