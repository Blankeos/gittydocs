import { createProcessor } from "@mdx-js/mdx"
import type { AutoTypeTableData } from "./auto-type-table"
import { autoTypeTableToMarkdown, remarkAutoTypeTable } from "./auto-type-table"

type Node = {
  type: string
  name?: string | null
  children?: Node[]
  attributes?: { type: string; name?: string; value?: unknown }[]
  position?: { start: { offset?: number }; end: { offset?: number } }
}

/** Build-only preprocessing; MDX is parsed, never compiled or executed. */
export async function resolveAutoTypeTablesInMarkdown(
  raw: string,
  mdxPath: string,
  root: string
): Promise<string> {
  if (!mdxPath.endsWith(".mdx") || !raw.includes("<AutoTypeTable")) return raw
  const processor = createProcessor({ format: "mdx" })
  const tree = processor.parse(raw) as Node
  const replacements: { node: Node; start: number; end: number }[] = []
  const visit = (node: Node) => {
    if (
      (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
      node.name === "AutoTypeTable"
    ) {
      const start = node.position?.start.offset
      const end = node.position?.end.offset
      if (start !== undefined && end !== undefined) replacements.push({ node, start, end })
    }
    node.children?.forEach(visit)
  }
  visit(tree)
  if (!replacements.length) return raw
  await remarkAutoTypeTable({ contentRoot: root })(tree, { path: mdxPath })
  for (const { node, start, end } of replacements.sort((a, b) => b.start - a.start)) {
    const expression = node.attributes?.[0]?.value as { value: string }
    const table = JSON.parse(expression.value) as AutoTypeTableData
    raw = raw.slice(0, start) + "\n\n" + autoTypeTableToMarkdown(table) + "\n\n" + raw.slice(end)
  }
  return raw
}
