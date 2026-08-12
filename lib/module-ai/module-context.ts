import { readModulePlainText } from "@/lib/ai/resume-requirements"
import type { JSONContent, ResumeModule } from "@/types/resume"

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
