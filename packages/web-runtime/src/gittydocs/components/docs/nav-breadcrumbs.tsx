import { createMemo, For, Show } from "solid-js"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { type NavItem, useDocsContext } from "@/gittydocs/contexts/docs.context"
import {
  findNavTrail,
  normalizeNavPath,
  opensInNewTab,
  resolveNavPagePath,
} from "@/gittydocs/lib/nav-utils"
import { withBasePath } from "@/utils/base-path"
import { DocsIcon, NewTabIndicator } from "./docs-icon"

export interface NavBreadcrumbsProps {
  routePath: string
}

/** Navigation ancestry, not guessed labels or links from URL segments. */
export function NavBreadcrumbs(props: NavBreadcrumbsProps) {
  const docs = useDocsContext()
  const route = () => normalizeNavPath(props.routePath, import.meta.env.BASE_URL)
  const pagesByRoute = createMemo(
    () =>
      new Map(
        docs.pages.map((page) => [normalizeNavPath(page.routePath, import.meta.env.BASE_URL), page])
      )
  )
  const trail = createMemo(() => {
    const ancestors = findNavTrail(docs.nav, props.routePath, import.meta.env.BASE_URL)
    if (ancestors.length > 0) return ancestors
    // A real page omitted from custom nav still has a title; never display a
    // route segment as a fabricated breadcrumb label.
    const page = pagesByRoute().get(route())
    return page ? [{ label: page.title, path: page.routePath } satisfies NavItem] : []
  })
  const validPath = (item: NavItem) => {
    return resolveNavPagePath(item, [...pagesByRoute().keys()], import.meta.env.BASE_URL)
  }

  return (
    <Show when={docs.config?.ui?.breadcrumbs !== false && trail().length > 0}>
      <Breadcrumb aria-label="Breadcrumb" class="not-prose mb-4">
        <BreadcrumbList>
          <For each={trail()}>
            {(item, index) => (
              <BreadcrumbItem>
                <Show when={index() > 0}>
                  <BreadcrumbSeparator />
                </Show>
                <Show
                  when={validPath(item)}
                  fallback={
                    <span
                      class={index() === trail().length - 1 ? "text-foreground" : undefined}
                      aria-current={index() === trail().length - 1 ? "page" : undefined}
                    >
                      {item.label}
                    </span>
                  }
                >
                  {(path) => (
                    <a
                      href={withBasePath(path())}
                      aria-current={index() === trail().length - 1 ? "page" : undefined}
                      target={opensInNewTab(item) ? "_blank" : undefined}
                      rel={opensInNewTab(item) ? "noopener noreferrer" : undefined}
                      data-vike={opensInNewTab(item) ? "false" : undefined}
                      class="inline-flex items-center gap-1.5 rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:text-foreground"
                    >
                      <Show when={item.icon}>
                        <DocsIcon name={item.icon} />
                      </Show>
                      {item.label}
                      <Show when={opensInNewTab(item)}>
                        <NewTabIndicator />
                      </Show>
                    </a>
                  )}
                </Show>
              </BreadcrumbItem>
            )}
          </For>
        </BreadcrumbList>
      </Breadcrumb>
    </Show>
  )
}
