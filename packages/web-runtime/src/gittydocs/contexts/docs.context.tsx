import { docs } from "@velite"
import { createMemo, type FlowComponent } from "solid-js"
import type { DocsConfig, NavItem } from "@/gittydocs/lib/docs/config.gen"
import { gittydocsConfig } from "@/gittydocs/lib/docs/config.gen"
import { customPagesByRoute } from "@/gittydocs/lib/docs/custom-pages"
import { type DocHeading, getDocHeadings } from "@/gittydocs/lib/heading-utils"
import {
  buildNavFromPages,
  createDocsNavigation,
  defaultLabel,
  normalizeMdxSourcePath,
} from "@/gittydocs/lib/nav-utils"
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

export type DocsContextValue = {
  pages: DocsPage[]
  config: DocsConfig | null
  nav: NavItem[]
  navigation: ReturnType<typeof createDocsNavigation<DocsPage>>
}

// ===========================================================================
// Context & Hook
// ===========================================================================

const [useDocsContext, Provider] = createStrictContext<DocsContextValue>("DocsContext")

export { useDocsContext }

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

  const navigation = createMemo(() =>
    createDocsNavigation(pages(), nav(), import.meta.env.BASE_URL)
  )

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
        get navigation() {
          return navigation()
        },
      }}
    >
      {props.children}
    </Provider>
  )
}
