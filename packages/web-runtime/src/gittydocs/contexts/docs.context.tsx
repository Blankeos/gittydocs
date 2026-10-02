import { docs } from "@velite"
import { Index } from "flexsearch"
import { createMemo, type FlowComponent } from "solid-js"
import type { DocsConfig, NavItem } from "@/gittydocs/lib/docs/config.gen"
import { gittydocsConfig } from "@/gittydocs/lib/docs/config.gen"
import { customPagesByRoute } from "@/gittydocs/lib/docs/custom-pages"
import { type DocHeading, getDocHeadings, headingText } from "@/gittydocs/lib/heading-utils"
import { buildNavFromPages, defaultLabel, normalizeMdxSourcePath } from "@/gittydocs/lib/nav-utils"
import { createStrictContext } from "@/utils/create-strict-context"

export type { NavItem }

// ===========================================================================
// Types
// ===========================================================================

export type Heading = DocHeading

export interface DocsPage {
  routePath: string
  sourcePath: string
  title: string
  description?: string
  date?: string
  categories?: string | string[]
  headings: Heading[]
  content: string
  rawContent: string
}

export interface SearchResult {
  routePath: string
  title: string
  snippet: string
}

export type DocsContextValue = {
  pages: DocsPage[]
  config: DocsConfig | null
  nav: NavItem[]
  search: (query: string) => SearchResult[]
}

// ===========================================================================
// Context & Hook
// ===========================================================================

const [useDocsContext, Provider] = createStrictContext<DocsContextValue>("DocsContext")

export { useDocsContext }

// ===========================================================================
// Search Index
// ===========================================================================

class SearchIndex {
  private index: Index
  private pages: Map<string, DocsPage>

  constructor() {
    this.index = new Index({
      tokenize: "forward",
      cache: true,
    })
    this.pages = new Map()
  }

  addPage(page: DocsPage): void {
    this.index.add(page.routePath, page.title)

    if (page.description) {
      this.index.append(page.routePath, page.description)
    }

    for (const heading of page.headings) {
      this.index.append(page.routePath, heading.plainText ?? headingText(heading.text))
    }

    const bodyText = this.stripMarkdown(page.rawContent)
    this.index.append(page.routePath, bodyText)

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
    return content
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`]*`/g, "")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/(\*\*|__|\*|_)/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
  }

  private generateSnippet(content: string, query: string): string {
    const text = this.stripMarkdown(content)
    const lowerText = text.toLowerCase()
    const lowerQuery = query.toLowerCase()

    const index = lowerText.indexOf(lowerQuery)
    if (index === -1) {
      return text.slice(0, 150) + (text.length > 150 ? "..." : "")
    }

    const start = Math.max(0, index - 60)
    const end = Math.min(text.length, index + query.length + 90)

    let snippet = text.slice(start, end)
    if (start > 0) snippet = `...${snippet}`
    if (end < text.length) snippet = `${snippet}...`

    return snippet
  }
}

// ===========================================================================
// Helper Functions
// ===========================================================================

function toRoutePath(slug: string): string {
  let route = slug.replace(/^\/?/, "")
  if (route.endsWith("/index") || route === "index") {
    route = route.replace(/\/?index$/, "") || "/"
  }
  if (route.endsWith("/readme") || route.toLowerCase() === "readme") {
    route = route.replace(/\/?readme$/, "") || "/"
  }
  return route.startsWith("/") ? route : `/${route}`
}

// ===========================================================================
// Provider
// ===========================================================================

export const DocsContextProvider: FlowComponent = (props) => {
  // Transform velite docs + custom TSX pages to our format
  const pages = createMemo<DocsPage[]>(() => {
    const mdxPages = docs.map((doc) => {
      const routePath = toRoutePath(doc.slugAsParams)
      const headings = getDocHeadings(doc)

      return {
        routePath,
        sourcePath: doc.sourcePath ? normalizeMdxSourcePath(doc.sourcePath) : doc.slugAsParams,
        title: doc.title || "Untitled",
        description: doc.description,
        date: doc.date,
        categories: doc.categories,
        headings,
        content: doc.content,
        rawContent: doc.rawMarkdown || "",
      } satisfies DocsPage
    })

    const customPages = Object.entries(customPagesByRoute).map(([routePath, page]) => {
      return {
        routePath,
        sourcePath: page.sourcePath,
        title: page.title || defaultLabel(page.sourcePath.split("/").pop() || page.sourcePath),
        description: page.description,
        headings: [],
        content: "",
        rawContent: page.description || page.title || "",
      } satisfies DocsPage
    })

    return [...mdxPages, ...customPages]
  })

  // Build navigation
  const nav = createMemo<NavItem[]>(() => {
    return buildNavFromPages(pages(), gittydocsConfig?.nav)
  })

  // Initialize search index
  const searchIndex = createMemo(() => {
    const index = new SearchIndex()
    for (const page of pages()) {
      index.addPage(page)
    }
    return index
  })

  // Search function
  const search = (query: string): SearchResult[] => {
    return searchIndex().search(query)
  }

  return (
    <Provider
      value={{
        get pages() {
          return pages()
        },
        config: gittydocsConfig,
        get nav() {
          return nav()
        },
        search,
      }}
    >
      {props.children}
    </Provider>
  )
}
