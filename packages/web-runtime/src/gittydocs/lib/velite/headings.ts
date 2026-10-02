import { VeliteFile } from "velite"
import type { DocHeading, HeadingInlineSegment } from "../heading-utils"

type CompilerNode = {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: CompilerNode[]
  position?: unknown
}

// Key by the loaded file, not its path: watch rebuilds replace the file, and
// metadata from an earlier compilation must never leak into the next one.
const compiledHeadings = new WeakMap<VeliteFile, DocHeading[]>()

export function getCompiledHeadings(file: VeliteFile): DocHeading[] {
  return compiledHeadings.get(file) ?? []
}

function textContent(node: CompilerNode): string {
  if (node.type === "text") return node.value ?? ""
  return node.children?.map(textContent).join("") ?? ""
}

function readableSegments(node: CompilerNode): HeadingInlineSegment[] {
  // Expressions/ESM have a `value`, but it is JavaScript source, not text.
  if (node.type === "text") return [{ type: "text", value: node.value ?? "" }]
  if (node.type === "element" && node.tagName === "code") {
    return [{ type: "code", value: textContent(node) }]
  }
  if (node.type === "element" && node.tagName === "br") {
    return [{ type: "text", value: "\n" }]
  }
  // KaTeX contains MathML, a TeX annotation, and visual HTML. Use the authored
  // TeX once for labels, but retain rehype-slug's actual (post-KaTeX) ID.
  if (node.type === "element" && node.tagName === "annotation") {
    return [{ type: "text", value: textContent(node) }]
  }
  if (node.type === "element" && Array.isArray(node.properties?.className)) {
    if (node.properties.className.includes("katex")) {
      const annotation = findAnnotation(node)
      if (annotation) return readableSegments(annotation)
    }
  }
  return node.children?.flatMap(readableSegments) ?? []
}

function findAnnotation(node: CompilerNode): CompilerNode | undefined {
  if (node.tagName === "annotation" && node.properties?.encoding === "application/x-tex") {
    return node
  }
  for (const child of node.children ?? []) {
    const annotation = findAnnotation(child)
    if (annotation) return annotation
  }
}

function inlineMarkdown(segment: HeadingInlineSegment): string {
  if (segment.type === "text") {
    // Labels are parsed as inline Markdown by the ToC. Escape syntax so literal
    // braces, HTML, emphasis, and backticks aren't interpreted a second time.
    return segment.value.replace(/[\\`*_[\]{}<>!&#$~|()+.=:"'-]/g, "\\$&")
  }
  const runs = segment.value.match(/`+/g) ?? []
  const fence = "`".repeat(Math.max(0, ...runs.map((run) => run.length)) + 1)
  const padding = /^`|`$|^ .* $/.test(segment.value) && /[^ ]/.test(segment.value) ? " " : ""
  return `${fence}${padding}${segment.value}${padding}${fence}`
}

/** Run after rehype-slug and before autolinks, on the actual compiled MDX HAST. */
export function rehypeExtractHeadings() {
  return (tree: CompilerNode, file: { path?: string; data: Record<string, unknown> }) => {
    const headings: DocHeading[] = []
    const visit = (node: CompilerNode) => {
      if (node.type === "element" && /^h[1-6]$/.test(node.tagName ?? "")) {
        const id = node.properties?.id
        // Exclude generated headings (e.g. GFM's "Footnotes" label), not
        // authored headings nested in components or referenced footnotes.
        if (node.position && typeof id === "string") {
          const segments: HeadingInlineSegment[] = []
          for (const segment of readableSegments(node)) {
            const previous = segments[segments.length - 1]
            // Adjacent code elements must not produce ambiguous backtick runs
            // when their display Markdown is parsed again by the ToC.
            if (previous?.type === segment.type) previous.value += segment.value
            else segments.push(segment)
          }
          headings.push({
            level: Number(node.tagName?.slice(1)),
            slug: id,
            text: segments.map(inlineMarkdown).join(""),
            plainText: segments.map((segment) => segment.value).join(""),
          })
        }
      }
      node.children?.forEach(visit)
    }
    visit(tree)
    file.data.headings = headings
    const meta = file.path ? VeliteFile.get(file.path) : undefined
    if (meta) compiledHeadings.set(meta, headings)
  }
}
