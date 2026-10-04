import { createProcessor } from "@mdx-js/mdx"
import {
  type AutoTypeTableNode,
  autoTypeTableToMarkdown,
  resolveAutoTypeTableNodes,
} from "./auto-type-table"

/** Build-only preprocessing; MDX is parsed, never compiled or executed. */
export async function resolveAutoTypeTablesInMarkdown(
  raw: string,
  mdxPath: string,
  root: string
): Promise<string> {
  if (!mdxPath.endsWith(".mdx") || !raw.includes("<AutoTypeTable")) return raw
  const processor = createProcessor({ format: "mdx" })
  const tree = processor.parse(raw) as AutoTypeTableNode
  const resolved = await resolveAutoTypeTableNodes(tree, { path: mdxPath }, { contentRoot: root })
  // Replace from right to left so source offsets remain valid. Receive data
  // directly instead of decoding the MDX adapter's generated JSX attributes.
  for (const { node, table } of resolved.reverse()) {
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    if (start === undefined || end === undefined) continue
    raw = `${raw.slice(0, start)}\n\n${autoTypeTableToMarkdown(table)}\n\n${raw.slice(end)}`
  }
  return raw
}
