export interface DocHeading {
  level: number
  text: string
  slug: string
}

export type HeadingInlineSegment =
  | { type: "text"; value: string }
  | { type: "code"; value: string }

export function parseHeadingInlineContent(text: string): HeadingInlineSegment[] {
  const segments: HeadingInlineSegment[] = []
  const regex = /`([^`]+)`/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) })
    }
    segments.push({ type: "code", value: match[1] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) })
  }

  if (segments.length === 0) {
    segments.push({ type: "text", value: text })
  }

  return segments
}

export function slugifyHeadingText(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "$1")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
}

export function extractHeadingsFromMarkdown(content: string): DocHeading[] {
  const headingsList: DocHeading[] = []
  const lines = content.split("\n")
  let inFence = false
  let fenceChar: string | null = null
  let fenceLength = 0

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/)
    if (fenceMatch) {
      const marker = fenceMatch[1]
      if (!inFence) {
        inFence = true
        fenceChar = marker[0]
        fenceLength = marker.length
        continue
      }

      if (fenceChar && marker[0] === fenceChar && marker.length >= fenceLength) {
        inFence = false
        fenceChar = null
        fenceLength = 0
        continue
      }
    }

    if (inFence) continue

    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (!match) continue

    const level = match[1].length
    const text = match[2].trim()
    headingsList.push({ level, text, slug: slugifyHeadingText(text) })
  }

  return headingsList
}
