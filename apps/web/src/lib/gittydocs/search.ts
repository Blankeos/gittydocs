import FlexSearch from "flexsearch"
import type { DocsPage, SearchResult } from "./types"

export class SearchIndex {
  private index: FlexSearch.Index
  private pages: Map<string, DocsPage>

  constructor() {
    this.index = new FlexSearch.Index({
      tokenize: "forward",
      cache: true,
    })
    this.pages = new Map()
  }

  addPage(page: DocsPage): void {
    // Index by title
    this.index.add(page.routePath, page.title)

    // Index by description
    if (page.description) {
      this.index.append(page.routePath, page.description)
    }

    // Index by headings
    for (const heading of page.headings) {
      this.index.append(page.routePath, heading.text)
    }

    // Index by content (stripped)
    const bodyText = this.stripMarkdown(page.rawContent)
    this.index.append(page.routePath, bodyText)

    // Store page for retrieving results
    this.pages.set(page.routePath, page)
  }

  search(query: string): SearchResult[] {
    if (!query.trim()) return []

    const results = this.index.search(query, 10)
    const searchResults: SearchResult[] = []

    for (const routePath of results) {
      const path = String(routePath)
      const page = this.pages.get(path)
      if (!page) continue

      // Generate snippet from content
      const snippet = this.generateSnippet(page.rawContent, query)

      searchResults.push({
        routePath: path,
        title: page.title,
        snippet,
      })
    }

    return searchResults
  }

  private stripMarkdown(content: string): string {
    return (
      content
        // Remove code blocks
        .replace(/```[\s\S]*?```/g, "")
        // Remove inline code
        .replace(/`[^`]*`/g, "")
        // Remove headings
        .replace(/^#{1,6}\s+/gm, "")
        // Remove bold/italic
        .replace(/(\*\*|__|\*|_)/g, "")
        // Remove links
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        // Remove images
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
        // Remove HTML tags
        .replace(/<[^\u003e]*>/g, "")
        // Normalize whitespace
        .replace(/\s+/g, " ")
        .trim()
    )
  }

  private generateSnippet(content: string, query: string): string {
    const text = this.stripMarkdown(content)
    const lowerText = text.toLowerCase()
    const lowerQuery = query.toLowerCase()

    const index = lowerText.indexOf(lowerQuery)
    if (index === -1) {
      // Return first 150 chars if no match found
      return text.slice(0, 150) + (text.length > 150 ? "..." : "")
    }

    // Get context around the match
    const start = Math.max(0, index - 60)
    const end = Math.min(text.length, index + query.length + 90)

    let snippet = text.slice(start, end)
    if (start > 0) snippet = `...${snippet}`
    if (end < text.length) snippet = `${snippet}...`

    return snippet
  }

  clear(): void {
    this.index = new FlexSearch.Index({
      tokenize: "forward",
      cache: true,
    })
    this.pages.clear()
  }
}
