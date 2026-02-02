import { docs } from "@velite"
import { createMemo, type FlowComponent } from "solid-js"
import { createStrictContext } from "@/utils/create-strict-context"
import type { DocsConfig, NavItem } from "@/gittydocs/lib/docs/config.gen"
import { gittydocsConfig } from "@/gittydocs/lib/docs/config.gen"
import { Index } from "flexsearch"

// ===========================================================================
// Types
// ===========================================================================

export interface Heading {
  level: number
  text: string
  slug: string
}

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
      this.index.append(page.routePath, heading.text)
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
    return (
      content
        .replace(/```[\s\S]*?```/g, "")
        .replace(/`[^`]*`/g, "")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/(\*\*|__|\*|_)/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
        .replace(/<[^>]*>/g, "")
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

function extractHeadings(content: string): Heading[] {
  const headings: Heading[] = []
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
    const slug = slugify(text)
    headings.push({ level, text, slug })
  }

  return headings
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
}

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

function buildNavFromPages(pages: DocsPage[], configNav?: NavItem[]): NavItem[] {
  if (configNav && configNav.length > 0) {
    return configNav
  }

  // Build nav from file structure
  const tree = buildFileTree(pages.map((p) => p.sourcePath))
  return buildNavFromTree(tree, pages)
}

interface FileNode {
  name: string
  path: string
  type: "file" | "directory"
  children?: FileNode[]
}

function buildFileTree(paths: string[]): FileNode[] {
  const root: FileNode = { name: "", path: "", type: "directory", children: [] }

  for (const filePath of paths) {
    const parts = filePath.split("/").filter(Boolean)
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      if (!current.children) current.children = []

      let next = current.children.find((child) => child.name === part)
      if (!next) {
        next = {
          name: part,
          path: current.path ? `${current.path}/${part}` : part,
          type: isFile ? "file" : "directory",
          children: isFile ? undefined : [],
        }
        current.children.push(next)
      }

      current = next
    }
  }

  return root.children || []
}

function buildNavFromTree(tree: FileNode[], pages: DocsPage[]): NavItem[] {
  const nav: NavItem[] = []

  const sorted = [...tree].sort((a, b) => {
    const aIsIndex = a.name.startsWith("index.")
    const bIsIndex = b.name.startsWith("index.")

    if (aIsIndex && !bIsIndex) return -1
    if (!aIsIndex && bIsIndex) return 1

    const aNum = a.name.match(/^(\d+)-/)
    const bNum = b.name.match(/^(\d+)-/)

    if (aNum && bNum) return parseInt(aNum[1], 10) - parseInt(bNum[1], 10)
    if (aNum) return -1
    if (bNum) return 1

    return a.name.localeCompare(b.name)
  })

  for (const node of sorted) {
    if (node.type === "directory" && node.children) {
      const children = buildNavFromTree(node.children, pages)
      if (children.length > 0) {
        nav.push({
          label: formatLabel(node.name),
          items: children,
        })
      }
      continue
    }

    if (node.type === "file") {
      const routePath = toRoutePath(node.path.replace(/\.(md|mdx)$/i, ""))
      const page = pages.find((p) => p.routePath === routePath)
      const label = page?.title || defaultLabel(node.name)
      nav.push({ label, path: routePath })
    }
  }

  return nav
}

function defaultLabel(name: string): string {
  if (name.startsWith("index.")) return "Overview"
  return formatLabel(name.replace(/\.(md|mdx)$/i, ""))
}

function formatLabel(name: string): string {
  const cleanName = name.replace(/^\d+-/, "")
  return cleanName
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

// ===========================================================================
// Provider
// ===========================================================================

export const DocsContextProvider: FlowComponent = (props) => {
  // Transform velite docs to our format
  const pages = createMemo<DocsPage[]>(() => {
    return docs.map((doc) => {
      const routePath = toRoutePath(doc.slugAsParams)
      const headings = extractHeadings(doc.rawMarkdown || "")

      return {
        routePath,
        sourcePath: doc.slugAsParams,
        title: doc.title || "Untitled",
        description: doc.description,
        date: doc.date,
        categories: doc.categories,
        headings,
        content: doc.content,
        rawContent: doc.rawMarkdown || "",
      }
    })
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
        get pages() { return pages() },
        config: gittydocsConfig,
        get nav() { return nav() },
        search,
      }}
    >
      {props.children}
    </Provider>
  )
}
