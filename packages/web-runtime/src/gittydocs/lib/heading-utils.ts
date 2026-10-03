import GithubSlugger, { slug } from "github-slugger"
import { fromMarkdown } from "mdast-util-from-markdown"
import { gfmFromMarkdown } from "mdast-util-gfm"
import { gfm } from "micromark-extension-gfm"

export interface DocHeading {
  level: number
  /** Inline Markdown, retained so the ToC can render code spans. */
  text: string
  slug: string
  plainText?: string
}

export type HeadingInlineSegment = { type: "text"; value: string } | { type: "code"; value: string }

type MarkdownNode = {
  type: string
  value?: string
  identifier?: string
  depth?: number
  children?: MarkdownNode[]
  position?: { start: { offset?: number }; end: { offset?: number } }
}

function parseMarkdown(content: string, mdx = false) {
  const options = {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  }
  const tree = fromMarkdown(content, options)
  if (!mdx) return tree
  // MDX expressions aren't text descendants when rehype-slug runs. Mask their
  // source rather than evaluating user JavaScript, preserving offsets and line
  // structure. This also lets unsupported {#id} remain literal Markdown.
  const characters = content.split("")
  let changed = false
  const maskExpressions = (node: MarkdownNode) => {
    if (node.type === "text") {
      const start = node.position?.start.offset
      const end = node.position?.end.offset
      if (start === undefined || end === undefined) return
      const source = content.slice(start, end)
      for (const match of source.matchAll(/(?<!\\)\{(?!#)[^{}]*\}/g)) {
        const offset = start + (match.index ?? 0)
        for (let index = offset; index < offset + match[0].length; index++) {
          if (!/[\r\n]/.test(characters[index])) characters[index] = "\u200B"
        }
        changed = true
      }
    } else if (node.type !== "code" && node.type !== "inlineCode" && node.type !== "html") {
      node.children?.forEach(maskExpressions)
    }
  }
  maskExpressions(tree)
  const result = changed ? fromMarkdown(characters.join(""), options) : tree
  const removeMask = (node: MarkdownNode) => {
    if (node.type === "text") node.value = node.value?.replace(/\u200B/g, "")
    node.children?.forEach(removeMask)
  }
  if (changed) removeMask(result)
  return result
}

function inlineSegments(
  nodes: MarkdownNode[],
  footnotes: Map<string, number> = new Map()
): HeadingInlineSegment[] {
  const segments: HeadingInlineSegment[] = []
  const append = (segment: HeadingInlineSegment) => {
    const previous = segments[segments.length - 1]
    if (previous?.type === "text" && segment.type === "text") previous.value += segment.value
    else segments.push(segment)
  }
  const visit = (node: MarkdownNode) => {
    if (node.type === "text" || node.type === "inlineCode") {
      append({ type: node.type === "inlineCode" ? "code" : "text", value: node.value ?? "" })
    } else if (node.type === "break") {
      append({ type: "text", value: "\n" })
    } else if (node.type === "footnoteReference") {
      const identifier = node.identifier ?? ""
      if (!footnotes.has(identifier)) footnotes.set(identifier, footnotes.size + 1)
      append({ type: "text", value: String(footnotes.get(identifier)) })
    } else if (node.children) {
      node.children.forEach(visit)
    }
    // Images and raw HTML have no text descendants in the compiler's HAST.
    // In particular, image alt text must not become part of a heading's ID.
  }
  nodes.forEach(visit)
  return segments
}

export function parseHeadingInlineContent(text: string): HeadingInlineSegment[] {
  const tree = parseMarkdown(text, true)
  return inlineSegments(tree.children)
}

export function headingText(text: string): string {
  return parseHeadingInlineContent(text)
    .map((segment) => segment.value)
    .join("")
}

export function slugifyHeadingText(text: string): string {
  return slug(headingText(text))
}

function withoutFrontmatter(content: string): string {
  // Velite removes YAML frontmatter before compiling MDX. Keep it out of both
  // setext and ATX heading extraction, including heading-like multiline values.
  return content.replace(
    /^\uFEFF?---[^\S\r\n]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[^\S\r\n]*(?:\r?\n|$)/,
    ""
  )
}

/** Best-effort fallback for old data; compiled documents use getDocHeadings. */
export function extractHeadingsFromMarkdown(content: string): DocHeading[] {
  const markdown = withoutFrontmatter(content)
  const tree = parseMarkdown(markdown, true)
  const slugger = new GithubSlugger()
  const footnotes = new Map<string, number>()
  const definitions = new Map<string, MarkdownNode>()
  const collectDefinitions = (node: MarkdownNode) => {
    if (node.type === "footnoteDefinition" && node.identifier) {
      definitions.set(node.identifier, node)
    } else node.children?.forEach(collectDefinitions)
  }
  collectDefinitions(tree)
  const headings: DocHeading[] = []

  const visit = (node: MarkdownNode) => {
    if (node.type === "heading") {
      const children = node.children ?? []
      const plainText = inlineSegments(children, footnotes)
        .map((segment) => segment.value)
        .join("")
      // Taking the inline source preserves code delimiters, links and escapes,
      // while excluding indentation and optional closing ATX hashes.
      const start = children[0]?.position?.start.offset
      const end = children[children.length - 1]?.position?.end.offset
      const text = start !== undefined && end !== undefined ? markdown.slice(start, end) : ""
      headings.push({ level: node.depth ?? 1, text, plainText, slug: slugger.slug(plainText) })
      return
    }
    if (node.type === "footnoteReference") {
      const identifier = node.identifier ?? ""
      if (!footnotes.has(identifier)) footnotes.set(identifier, footnotes.size + 1)
    }
    // Definitions are moved to the end by remark-rehype; their contents aren't
    // part of the document's heading sequence. Fences/indented code/HTML are
    // leaf nodes, so heading-looking source inside them is naturally ignored.
    if (node.type !== "footnoteDefinition") node.children?.forEach(visit)
  }
  visit(tree)
  // remark-rehype appends referenced footnote definitions after the body. Its
  // generated footnote-label heading already has an ID, so it doesn't consume
  // a slugger occurrence, but authored headings inside definitions do.
  for (const identifier of footnotes.keys()) {
    definitions.get(identifier)?.children?.forEach(visit)
  }
  return headings
}

/**
 * Compiler metadata is authoritative, including an intentionally empty list.
 * Older generated data can still use the best-effort Markdown fallback.
 */
export function getDocHeadings(doc: {
  headings?: DocHeading[]
  rawMarkdown?: string
}): DocHeading[] {
  return doc.headings ?? extractHeadingsFromMarkdown(doc.rawMarkdown ?? "")
}

/** Readable, inert text for search indexing and snippets (never HTML). */
export function markdownToSearchText(content: string): string {
  const tree = parseMarkdown(withoutFrontmatter(content), true)
  const values: string[] = []
  const visit = (node: MarkdownNode) => {
    if (node.type === "text" || node.type === "inlineCode" || node.type === "code") {
      values.push(node.value ?? "")
    } else {
      node.children?.forEach(visit)
    }
  }
  visit(tree)
  return values.join(" ").replace(/\s+/g, " ").trim()
}
