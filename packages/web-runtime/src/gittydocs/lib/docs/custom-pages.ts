import type { Component } from "solid-js"

export type CustomPageModule = {
  default?: Component
  sidebar?: boolean
  sideNav?: boolean
  toc?: boolean
  title?: string
  description?: string
}

export type CustomPage = {
  Component: Component
  sidebar: boolean
  toc: boolean
  title?: string
  description?: string
  sourcePath: string
}

const modules = import.meta.glob<CustomPageModule>(
  ["/content/docs/**/*.{tsx,jsx}", "!/content/docs/**/_*/**/*.{tsx,jsx}"],
  {
    eager: true,
  }
)

function isPrivateSourcePath(filePath: string): boolean {
  return filePath
    .replace(/^\/content\/docs\//, "")
    .split("/")
    .some((segment) => segment.startsWith("_"))
}

function filePathToRoute(filePath: string): string {
  const relative = filePath
    .replace(/^\/content\/docs\//, "")
    .replace(/\.(tsx|jsx)$/i, "")
    .replace(/\\/g, "/")

  let route = relative
  if (route.endsWith("/index") || route === "index") {
    route = route.replace(/\/?index$/, "") || "/"
  }
  if (route.endsWith("/readme") || route.toLowerCase() === "readme") {
    route = route.replace(/\/?readme$/, "") || "/"
  }
  return route.startsWith("/") ? route : `/${route}`
}

function filePathToSourcePath(filePath: string): string {
  return filePath.replace(/^\/content\/docs\//, "").replace(/\\/g, "/")
}

function resolveSidebar(module: CustomPageModule): boolean {
  if (typeof module.sidebar === "boolean") return module.sidebar
  if (typeof module.sideNav === "boolean") return module.sideNav
  return true
}

export const customPagesByRoute: Record<string, CustomPage> = Object.fromEntries(
  Object.entries(modules)
    .filter(
      ([filePath, module]) => !isPrivateSourcePath(filePath) && typeof module.default === "function"
    )
    .map(([filePath, module]) => {
      const routePath = filePathToRoute(filePath)
      const page: CustomPage = {
        Component: module.default!,
        sidebar: resolveSidebar(module),
        toc: module.toc ?? true,
        title: module.title,
        description: module.description,
        sourcePath: filePathToSourcePath(filePath),
      }
      return [routePath, page] as const
    })
)

export function getCustomPage(routePath: string): CustomPage | undefined {
  const normalized = !routePath || routePath === "/" ? "/" : routePath
  return customPagesByRoute[normalized]
}

export function listCustomPageRoutes(): string[] {
  return Object.keys(customPagesByRoute).sort()
}
