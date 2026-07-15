import { docs } from "@velite"
import type { Component } from "solid-js"
import { getCustomPage } from "@/gittydocs/lib/docs/custom-pages"

export type PageLayoutMeta = {
  sidebar: boolean
  toc: boolean
  title?: string
  description?: string
}

export type ResolvedPage = PageLayoutMeta & {
  kind: "custom" | "mdx" | "missing"
  CustomComponent?: Component
  mdx?: (typeof docs)[number]
}

function normalizeRoutePath(routePath: string): string {
  if (!routePath || routePath === "/") return "/"
  return routePath.startsWith("/") ? routePath : `/${routePath}`
}

export function findMdxDoc(routePath: string) {
  const normalized = normalizeRoutePath(routePath)
  return docs.find((d) => {
    const docSlug = d.slugAsParams === "" ? "/" : `/${d.slugAsParams}`
    return docSlug === normalized
  })
}

export function resolvePage(routePath: string): ResolvedPage {
  const normalized = normalizeRoutePath(routePath)
  const custom = getCustomPage(normalized)

  if (custom?.Component) {
    return {
      kind: "custom",
      sidebar: custom.sidebar,
      toc: custom.toc,
      title: custom.title,
      description: custom.description,
      CustomComponent: custom.Component,
    }
  }

  const mdx = findMdxDoc(normalized)
  if (mdx) {
    return {
      kind: "mdx",
      sidebar: mdx.sidebar ?? true,
      toc: mdx.toc ?? true,
      title: mdx.title,
      description: mdx.description,
      mdx,
    }
  }

  return {
    kind: "missing",
    sidebar: true,
    toc: true,
  }
}
