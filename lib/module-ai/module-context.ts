import { readModulePlainText } from "@/lib/ai/resume-requirements"
import type { JSONContent, ResumeData, ResumeModule } from "@/types/resume"
import { FONT_FAMILIES, FONT_SIZES, TEXT_ALIGNMENTS } from "@/lib/rich-text-options"

export function serializeResumeContext(resume: ResumeData) {
  return {
    title: resume.title,
    centerTitle: resume.centerTitle ?? false,
    jobIntention: resume.jobIntentionSection ?? null,
    personalInfo: resume.personalInfoSection,
    modules: resume.modules.map(serializeModuleContext),
  }
}

export const MODULE_AI_LAYOUT_CAPABILITIES = {
  rowTypes: ["rich", "tags"],
  columns: [1, 2, 3, 4],
  nodes: ["doc", "paragraph", "bulletList", "orderedList", "listItem", "text", "hardBreak"],
  marks: ["bold", "italic", "underline", "strike", "code", "textStyle", "link"],
  textAlign: TEXT_ALIGNMENTS,
  fontFamily: FONT_FAMILIES.map((font) => font.value),
  fontSize: FONT_SIZES.map((size) => `${size}pt`),
  color: "十六进制颜色，例如 #000000",
  linkProtocols: ["http:", "https:", "mailto:", "tel:"],
} as const

export function serializeModuleContext(module: ResumeModule) {
  return {
    moduleId: module.id,
    title: module.title,
    order: module.order,
    currentContent: readModulePlainText(module),
    rows: [...module.rows]
      .sort((left, right) => left.order - right.order)
      .map((row) => ({
        rowId: row.id,
        type: row.type ?? "rich",
        columns: row.columns,
        order: row.order,
        tags: row.type === "tags" ? row.tags ?? [] : undefined,
        elements:
          row.type === "tags"
            ? []
            : [...row.elements]
                .sort((left, right) => left.columnIndex - right.columnIndex)
                .map((element) => ({
                  elementId: element.id,
                  columnIndex: element.columnIndex,
                  text: readContentText(element.content),
                  content: element.content,
                })),
      })),
  }
}

function readContentText(node: JSONContent): string {
  return `${node.text ?? ""}${node.content?.map(readContentText).join("") ?? ""}`
}
