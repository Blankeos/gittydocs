import { createMemo } from "solid-js"
import { usePageContext } from "vike-solid/usePageContext"
import { resolvePage } from "@/gittydocs/lib/docs/page-layout"
import { stripBasePath } from "@/utils/base-path"

export function useRoutePath() {
  const pageContext = usePageContext()
  return createMemo(() => {
    const pathname = pageContext.urlParsed.pathname || "/"
    return stripBasePath(pathname)
  })
}

export function usePageLayout() {
  const routePath = useRoutePath()
  const page = createMemo(() => resolvePage(routePath()))

  return {
    routePath,
    page,
    sidebar: createMemo(() => page().sidebar),
    toc: createMemo(() => page().toc),
  }
}
