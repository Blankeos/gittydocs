import { fromMarkdown } from "mdast-util-from-markdown"

const builtIns = new Set(["Steps", "Step", "Files", "Folder", "File", "Accordions", "Accordion"])

type MarkdownNode = string | ComponentNode
interface ComponentNode {
  name: string
  attributes: Record<string, string | undefined>
  children: MarkdownNode[]
  raw: string
}
interface Tag {
  name: string
  closing: boolean
  selfClosing: boolean
  attributes: Record<string, string | undefined>
  end: number
}

/**
 * Convert Gittydocs' built-in MDX components to portable Markdown.
 * Browser-safe: no filesystem, DOM, eval, or Node/Bun dependencies. Unknown JSX,
 * imports, dynamic labels, and code examples are deliberately left intact.
 */
export function toReadableMarkdown(raw: string): string {
  const { text, restore } = protectCode(raw)
  let cursor = 0
  const parseNodes = (closingName?: string): { nodes: MarkdownNode[]; closed: boolean } => {
    const nodes: MarkdownNode[] = []
    while (cursor < text.length) {
      const start = text.indexOf("<", cursor)
      if (start === -1) {
        nodes.push(text.slice(cursor))
        cursor = text.length
        break
      }
      nodes.push(text.slice(cursor, start))
      const tag = readTag(text, start)
      if (!tag || !builtIns.has(tag.name)) {
        cursor = tag?.end ?? start + 1
        nodes.push(text.slice(start, cursor))
        continue
      }
      cursor = tag.end
      if (tag.closing) {
        if (tag.name === closingName) return { nodes, closed: true }
        nodes.push(text.slice(start, cursor))
        continue
      }
      const children = tag.selfClosing ? { nodes: [], closed: true } : parseNodes(tag.name)
      if (!children.closed) {
        nodes.push(text.slice(start, cursor))
      } else {
        nodes.push({
          name: tag.name,
          attributes: tag.attributes,
          children: children.nodes,
          raw: text.slice(start, cursor),
        })
      }
    }
    return { nodes, closed: !closingName }
  }
  return restore(renderNodes(parseNodes().nodes, { folderDepth: 0, headingDepth: 3 }))
}

interface RenderContext {
  folderDepth: number
  headingDepth: number
  steps?: { next: number }
}

function renderNodes(nodes: MarkdownNode[], context: RenderContext): string {
  return nodes
    .map((node) => (typeof node === "string" ? node : renderComponent(node, context)))
    .join("")
}

function renderComponent(node: ComponentNode, context: RenderContext): string {
  const { name, attributes, children } = node
  const labelKey = name === "Folder" || name === "File" ? "name" : "title"
  // Do not erase dynamic titles/names that cannot be evaluated outside the MDX page.
  if (Object.keys(attributes).includes(labelKey) && attributes[labelKey] === undefined)
    return node.raw
  if ((name === "Folder" || name === "File" || name === "Accordion") && !attributes[labelKey])
    return node.raw
  if (
    name === "File" &&
    Object.keys(attributes).includes("description") &&
    attributes.description === undefined
  )
    return node.raw

  if (name === "Steps") {
    return block(renderNodes(children, { ...context, steps: { next: 1 } }).trim())
  }
  if (name === "Files" || name === "Accordions") return block(renderNodes(children, context).trim())
  if (name === "Step" || name === "Accordion") {
    const number = name === "Step" && context.steps ? context.steps.next++ : undefined
    const title = attributes.title ? escapeLabel(attributes.title) : "Step"
    const heading = `${"#".repeat(Math.min(context.headingDepth, 6))} ${number ? `${number}. ` : ""}${title}`
    const body = renderNodes(children, {
      ...context,
      headingDepth: context.headingDepth + 1,
    }).trim()
    return block(heading + (body ? `\n\n${body}` : ""))
  }
  const indent = "  ".repeat(context.folderDepth)
  const label = codeLabel(
    attributes.name! + (name === "Folder" && !attributes.name!.endsWith("/") ? "/" : "")
  )
  const description = attributes.description ? ` — ${escapeLabel(attributes.description)}` : ""
  const body = renderNodes(children, { ...context, folderDepth: context.folderDepth + 1 }).trimEnd()
  return `\n${indent}- ${label}${description}${body.trim() ? `\n${body.replace(/^\n+/, "")}` : ""}\n`
}

function block(value: string): string {
  return value ? `\n\n${value}\n\n` : ""
}

function escapeLabel(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/([\\*_[\]<>])/g, "\\$1")
}

function codeLabel(value: string): string {
  const runs = value.match(/`+/g) ?? []
  const fence = "`".repeat(Math.max(0, ...runs.map((run) => run.length)) + 1)
  const padding = value.startsWith("`") || value.endsWith("`") || /^ .* $/.test(value) ? " " : ""
  return `${fence}${padding}${value}${padding}${fence}`
}

function readTag(text: string, start: number): Tag | undefined {
  const match = /^<\s*(\/?)\s*([A-Za-z][\w.-]*)\b/.exec(text.slice(start))
  if (!match) return undefined
  let cursor = start + match[0].length
  const attributes: Record<string, string | undefined> = {}
  while (cursor < text.length) {
    if (/\s/.test(text[cursor])) {
      cursor++
      continue
    }
    if (text[cursor] === ">" || text.slice(cursor, cursor + 2) === "/>") {
      const selfClosing = text[cursor] === "/"
      return {
        name: match[2],
        closing: Boolean(match[1]),
        selfClosing,
        attributes,
        end: cursor + (selfClosing ? 2 : 1),
      }
    }
    if (text[cursor] === "{") {
      const end = expressionEnd(text, cursor)
      if (end === -1) return undefined
      cursor = end
      continue
    }
    const attr = /^[\w:-]+/.exec(text.slice(cursor))
    if (!attr) return undefined
    cursor += attr[0].length
    while (/\s/.test(text[cursor] ?? "")) cursor++
    if (text[cursor] !== "=") continue
    cursor++
    while (/\s/.test(text[cursor] ?? "")) cursor++
    const quote = text[cursor]
    if (quote === '"' || quote === "'") {
      const end = quotedEnd(text, cursor)
      if (end === -1) return undefined
      attributes[attr[0]] = decodeEntities(text.slice(cursor + 1, end - 1))
      cursor = end
    } else if (quote === "{") {
      const end = expressionEnd(text, cursor)
      if (end === -1) return undefined
      attributes[attr[0]] = expressionLiteral(text.slice(cursor + 1, end - 1).trim())
      cursor = end
    } else {
      return undefined
    }
  }
  return undefined
}

function quotedEnd(text: string, start: number): number {
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === "\\") {
      i++
      continue
    }
    if (text[i] === text[start]) return i + 1
  }
  return -1
}

function expressionEnd(text: string, start: number): number {
  let depth = 1
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === '"' || text[i] === "'" || text[i] === "`") {
      const end = quotedEnd(text, i)
      if (end === -1) return -1
      i = end - 1
    } else if (text[i] === "{") depth++
    else if (text[i] === "}" && --depth === 0) return i + 1
  }
  return -1
}

function expressionLiteral(value: string): string | undefined {
  if (value.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(value)
      return typeof parsed === "string" ? parsed : undefined
    } catch {
      return undefined
    }
  }
  if (
    (value.startsWith("'") || value.startsWith("`")) &&
    quotedEnd(value, 0) === value.length &&
    !value.includes("${")
  ) {
    return value
      .slice(1, -1)
      .replace(/\\([\\'`"])/g, "$1")
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
  }
  return undefined
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, key: string) => {
    if (key.startsWith("#")) {
      const code = key[1].toLowerCase() === "x" ? parseInt(key.slice(2), 16) : Number(key.slice(1))
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity
    }
    return (
      ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[
        key.toLowerCase()
      ] ?? entity
    )
  })
}

function protectCode(raw: string): { text: string; restore: (text: string) => string } {
  let prefix = "\0GITTYDOCS_CODE_"
  while (raw.includes(prefix)) prefix += "_"
  const examples: string[] = []
  const save = (example: string) => `${prefix}${examples.push(example) - 1}\0`
  // Use original source ranges, not node.value: values omit container markers,
  // indentation, fence metadata and original line endings. JSX attribute template
  // literals are not Markdown code, even when CommonMark classifies them as such.
  const tagRanges: Array<[number, number]> = []
  for (let start = raw.indexOf("<"); start !== -1; start = raw.indexOf("<", start + 1)) {
    const tag = readTag(raw, start)
    if (tag) {
      tagRanges.push([start, tag.end])
      start = tag.end - 1
    }
  }
  type CodeNode = {
    type: string
    children?: CodeNode[]
    position?: { start: { offset?: number }; end: { offset?: number } }
  }
  const ranges: Array<[number, number]> = []
  const visit = (node: CodeNode) => {
    if (node.type === "code" || node.type === "inlineCode") {
      const start = node.position?.start.offset
      const end = node.position?.end.offset
      if (
        start !== undefined &&
        end !== undefined &&
        !(node.type === "inlineCode" && tagRanges.some(([from, to]) => start >= from && start < to))
      ) {
        const lineStart = raw.lastIndexOf("\n", start - 1) + 1
        const leading = raw.slice(lineStart, start)
        const rangeStart =
          node.type === "code" && /^(?:[ \t]*>[ \t]*)*[ \t]*$/.test(leading) ? lineStart : start
        const lineEnding =
          node.type === "code" ? /^(?:\r\n|\n|\r)/.exec(raw.slice(end))?.[0] : undefined
        ranges.push([rangeStart, end + (lineEnding?.length ?? 0)])
      }
    } else {
      node.children?.forEach(visit)
    }
  }
  visit(fromMarkdown(raw))
  // A standalone JSX wrapper otherwise swallows its Markdown body as an HTML
  // block. Mask tags as blockquote markers for a second parse, retaining offsets
  // and line structure without extending indented code through closing wrappers.
  // Leave indented tag-only lines visible so literal indented code still exists.
  const masked = raw.split("")
  for (const [start, end] of tagRanges) {
    const lineStart = raw.lastIndexOf("\n", start - 1) + 1
    const leading = raw.slice(lineStart, start)
    const inline = /\S/.test(leading)
    if (!inline && leading.replace(/\t/g, "    ").length >= 4) continue
    for (let index = start; index < end; index++) {
      if (!/[\r\n]/.test(masked[index])) masked[index] = inline ? "x" : ">"
    }
    // Do not manufacture an indented code block from text following inline JSX.
    const lineEnd = raw.indexOf("\n", end)
    if (/\S/.test(raw.slice(end, lineEnd === -1 ? raw.length : lineEnd))) {
      masked[start] = "x"
    }
  }
  visit(fromMarkdown(masked.join("")))
  ranges.sort((a, b) => a[0] - b[0])
  let protectedText = ""
  let sourceCursor = 0
  for (const [start, end] of ranges) {
    if (start < sourceCursor) continue
    protectedText += raw.slice(sourceCursor, start) + save(raw.slice(start, end))
    sourceCursor = end
  }
  protectedText += raw.slice(sourceCursor)

  // Arbitrary JSX can be a CommonMark HTML block, hiding Markdown descendants.
  // Retain the existing fence/inline scanner as a fallback for those MDX bodies.
  const lines = protectedText.match(/[^\n]*\n|[^\n]+$/g) ?? []
  let text = ""
  for (let i = 0; i < lines.length; i++) {
    const fence = /^[ \t]*(`{3,}|~{3,})/.exec(lines[i])
    if (!fence) {
      text += lines[i]
      continue
    }
    let example = lines[i]
    const closing = new RegExp(`^[ \\t]*${fence[1][0]}{${fence[1].length},}[ \\t]*\\r?\\n?$`)
    while (++i < lines.length) {
      example += lines[i]
      if (closing.test(lines[i])) break
    }
    text += save(example)
  }
  // Inline code spans can contain JSX too. Only equal-length backtick runs close them.
  let result = ""
  let cursor = 0
  const fallbackTagRanges: Array<[number, number]> = []
  for (let start = text.indexOf("<"); start !== -1; start = text.indexOf("<", start + 1)) {
    const tag = readTag(text, start)
    if (tag) {
      fallbackTagRanges.push([start, tag.end])
      start = tag.end - 1
    }
  }
  const runs = /`+/g
  while (true) {
    const run = runs.exec(text)
    if (!run) break
    const start = run.index
    const tagRange = fallbackTagRanges.find(([from, to]) => start >= from && start < to)
    if (tagRange) {
      runs.lastIndex = tagRange[1]
      continue
    }
    const length = run[0].length
    let end = -1
    while (true) {
      const close = runs.exec(text)
      if (!close) break
      if (close[0].length === length) {
        end = close.index + length
        break
      }
    }
    if (end === -1) break
    result += text.slice(cursor, start) + save(text.slice(start, end))
    cursor = end
  }
  result += text.slice(cursor)
  return {
    text: result,
    restore: (value) =>
      value.replace(
        new RegExp(`${prefix}(\\d+)\0`, "g"),
        (_, index: string) => examples[Number(index)]
      ),
  }
}
