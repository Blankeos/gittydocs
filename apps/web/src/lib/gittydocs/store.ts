import { createContext, useContext } from "solid-js"
import { createStore, type SetStoreFunction } from "solid-js/store"
import { docsPages, docsConfig } from "@/lib/docs/docs-data"
import { gittydocsSource } from "@/lib/docs/source.gen"
import { resolveNavItems } from "@/lib/gittydocs/config"
import { buildNavFromPaths } from "@/lib/gittydocs/nav"
import { SearchIndex } from "./search"
import type { DocsConfig, DocsPage, NavItem } from "./types"

export interface DocsContextValue {
  source: typeof gittydocsSource
  config: DocsConfig | null
  nav: NavItem[]
  pages: Map<string, DocsPage>
  currentPage: DocsPage | null
  isLoading: boolean
  error: string | null
  searchIndex: SearchIndex
  setCurrentPage: SetStoreFunction<DocsContextValue>
}

export function createDocsStore(): DocsContextValue {
  let setStoreRef: SetStoreFunction<DocsContextValue> | undefined

  const [store, setStore] = createStore<DocsContextValue>({
    source: gittydocsSource,
    config: docsConfig,
    nav: [],
    pages: new Map(),
    currentPage: null,
    isLoading: false,
    error: null,
    searchIndex: new SearchIndex(),
    setCurrentPage: (...args: unknown[]) => {
      if (setStoreRef) {
        ;(setStoreRef as (...args: unknown[]) => void)(...args)
      }
    },
  })

  setStoreRef = setStore
  store.setCurrentPage = setStore

  return store
}

export const DocsContext = createContext<DocsContextValue | undefined>(undefined)

export function useDocs() {
  const context = useContext(DocsContext)
  if (!context) {
    throw new Error("useDocs must be used within a DocsProvider")
  }
  return context
}

export function initializeDocs(store: DocsContextValue): void {
  const pages = new Map<string, DocsPage>()
  const sourcePaths: string[] = []
  const titleByRoute: Record<string, string> = {}
  const searchIndex = new SearchIndex()

  for (const page of docsPages) {
    pages.set(page.routePath, page)
    sourcePaths.push(page.sourcePath)
    titleByRoute[page.routePath] = page.title
    searchIndex.addPage(page)
  }

  const nav = buildNavFromPaths(sourcePaths, titleByRoute)
  const resolvedNav = resolveNavItems(store.config, nav)

  store.setCurrentPage("pages", pages)
  store.setCurrentPage("nav", resolvedNav)
  store.setCurrentPage("searchIndex", searchIndex)
  store.setCurrentPage("currentPage", pages.get("/") || null)
}

export async function loadPage(
  store: DocsContextValue,
  routePath: string
): Promise<DocsPage | null> {
  const normalizedPath = normalizeRoutePath(routePath)
  const existing = store.pages.get(normalizedPath)
  if (existing) {
    store.setCurrentPage("currentPage", existing)
    return existing
  }

  store.setCurrentPage("currentPage", null)
  return null
}

function normalizeRoutePath(routePath: string) {
  if (!routePath || routePath === "/") return "/"
  return routePath.replace(/\/$/, "")
}
