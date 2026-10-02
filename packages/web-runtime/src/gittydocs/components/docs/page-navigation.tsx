import { createMemo, Show } from "solid-js"
import { type NavItem, useDocsContext } from "@/gittydocs/contexts/docs.context"
import {
  flattenNav,
  isInternalHref,
  normalizeNavPath,
  opensInNewTab,
} from "@/gittydocs/lib/nav-utils"
import { withBasePath } from "@/utils/base-path"
import { DocsIcon, NewTabIndicator } from "./docs-icon"

export interface PageNavigationProps {
  routePath: string
}

interface NavigationPage {
  item: NavItem
  routePath: string
}

/** Previous/next actual docs pages, in depth-first navigation order. */
export function PageNavigation(props: PageNavigationProps) {
  const docs = useDocsContext()
  const pages = createMemo(() => {
    const knownRoutes = new Set(
      docs.pages.map((page) => normalizeNavPath(page.routePath, import.meta.env.BASE_URL))
    )
    const seen = new Set<string>()
    const ordered: NavigationPage[] = []

    for (const item of flattenNav(docs.nav)) {
      if (!item.path || !isInternalHref(item.path)) continue
      const routePath = normalizeNavPath(item.path, import.meta.env.BASE_URL)
      if (routePath === "/llms.txt" || seen.has(routePath) || !knownRoutes.has(routePath)) continue
      seen.add(routePath)
      ordered.push({ item, routePath })
    }
    return ordered
  })
  const index = () => {
    const route = normalizeNavPath(props.routePath, import.meta.env.BASE_URL)
    return pages().findIndex((page) => page.routePath === route)
  }
  const previous = () => (index() > 0 ? pages()[index() - 1] : undefined)
  const next = () => (index() >= 0 ? pages()[index() + 1] : undefined)

  return (
    <Show when={docs.config?.ui?.pageNavigation !== false && (previous() || next())}>
      <nav
        aria-label="Page navigation"
        class="not-prose mt-8 grid grid-cols-1 gap-3 border-t pt-6 sm:grid-cols-2"
      >
        <Show when={previous()}>
          {(page) => <PageNavigationLink page={page()} direction="previous" />}
        </Show>
        <Show when={next()}>{(page) => <PageNavigationLink page={page()} direction="next" />}</Show>
      </nav>
    </Show>
  )
}

function PageNavigationLink(props: { page: NavigationPage; direction: "previous" | "next" }) {
  const newTab = () => opensInNewTab(props.page.item)
  const isNext = () => props.direction === "next"

  return (
    <a
      href={withBasePath(props.page.routePath)}
      target={newTab() ? "_blank" : undefined}
      rel={newTab() ? "noopener noreferrer" : props.direction === "next" ? "next" : "prev"}
      data-vike={newTab() ? "false" : undefined}
      class="flex min-w-0 items-center gap-3 rounded-lg border p-4 transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      classList={{ "sm:col-start-2": isNext(), "flex-row-reverse text-right": isNext() }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      >
        <path d={isNext() ? "M5 12h14m-6-6 6 6-6 6" : "M19 12H5m6-6-6 6 6 6"} />
      </svg>
      <span class="min-w-0 flex-1">
        <span class="block text-muted-foreground text-xs">{isNext() ? "Next" : "Previous"}</span>
        <span
          class="mt-1 flex items-center gap-2 font-medium text-sm"
          classList={{ "justify-end": isNext() }}
        >
          <Show when={props.page.item.icon}>
            <DocsIcon name={props.page.item.icon} />
          </Show>
          <span class="min-w-0 break-words">{props.page.item.label}</span>
          <Show when={newTab()}>
            <NewTabIndicator />
          </Show>
        </span>
      </span>
    </a>
  )
}
