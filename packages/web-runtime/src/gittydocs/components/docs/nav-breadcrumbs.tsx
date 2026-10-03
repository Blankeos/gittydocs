import { createMemo, For, Show } from "solid-js"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { type NavItem, useDocsContext } from "@/gittydocs/contexts/docs.context"
import { opensInNewTab } from "@/gittydocs/lib/nav-utils"
import { withBasePath } from "@/utils/base-path"
import { DocsIcon, NewTabIndicator } from "./docs-icon"

export interface NavBreadcrumbsProps {
  routePath: string
}

/** Navigation ancestry, not guessed labels or links from URL segments. */
export function NavBreadcrumbs(props: NavBreadcrumbsProps) {
  const docs = useDocsContext()
  const current = createMemo(() => docs.navigation.resolve(props.routePath))
  const trail = createMemo(() => {
    const ancestors = current().trail
    if (ancestors.length > 0) return ancestors
    // A real page omitted from custom nav still has a title; never display a
    // route segment as a fabricated breadcrumb label.
    const page = current().page
    return page ? [{ label: page.title, path: page.routePath } satisfies NavItem] : []
  })
  const validPath = (item: NavItem) => docs.navigation.destination(item)

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
