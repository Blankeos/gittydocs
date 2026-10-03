export interface SearchHighlightSegment {
  text: string
  matched: boolean
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Literal matches only; all values stay text and are rendered through JSX. */
export function highlightSearchText(text: string, query: string): SearchHighlightSegment[] {
  const terms = [...new Set(query.trim().split(/\s+/).filter(Boolean))].sort(
    (a, b) => b.length - a.length
  )
  if (!terms.length) return [{ text, matched: false }]

  const regex = new RegExp(terms.map(escapeRegExp).join("|"), "giu")
  const segments: SearchHighlightSegment[] = []
  let offset = 0
  for (const match of text.matchAll(regex)) {
    const index = match.index ?? 0
    if (index > offset) segments.push({ text: text.slice(offset, index), matched: false })
    segments.push({ text: match[0], matched: true })
    offset = index + match[0].length
  }
  if (offset < text.length) segments.push({ text: text.slice(offset), matched: false })
  return segments.length ? segments : [{ text, matched: false }]
}

export function createSearchSnippet(text: string, query: string, length = 160): string {
  const normalized = text.replace(/\s+/g, " ").trim()
  const segments = highlightSearchText(normalized, query)
  const firstMatch = segments.findIndex((segment) => segment.matched)
  const matchOffset =
    firstMatch < 0
      ? 0
      : segments.slice(0, firstMatch).reduce((sum, part) => sum + part.text.length, 0)
  let start = Math.max(0, matchOffset - 45)
  // Avoid cutting a word when there is a nearby word boundary.
  if (start > 0) {
    const boundary = normalized.indexOf(" ", start)
    if (boundary !== -1 && boundary < matchOffset) start = boundary + 1
  }
  const end = Math.min(normalized.length, start + length)
  return `${start > 0 ? "…" : ""}${normalized.slice(start, end).trim()}${end < normalized.length ? "…" : ""}`
}
