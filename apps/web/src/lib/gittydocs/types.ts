// Types for gittydocs

export interface GitHubRepo {
  owner: string
  repo: string
  ref: string
  docsPath: string
}

export interface DocsConfig {
  site: {
    name: string
    logo?: string
    repo?: GitHubRepo
  }
  nav?: NavItem[]
  links?: {
    issues?: string
  }
}

export interface NavItem {
  label: string
  path?: string
  items?: NavItem[]
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

export interface Heading {
  level: number
  text: string
  slug: string
}

export interface SearchResult {
  routePath: string
  title: string
  snippet: string
  anchor?: string
}

export interface FileNode {
  name: string
  path: string
  type: "file" | "directory"
  children?: FileNode[]
}
