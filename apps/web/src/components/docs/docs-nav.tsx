import { For, Show } from "solid-js"
import { usePageContext } from "vike-solid/usePageContext"
import { useDocsContext, type NavItem } from "@/contexts/docs.context"
import { stripBasePath, withBasePath } from "@/utils/base-path"
import { cn } from "@/utils/cn"

export function DocsNav() {
  const docs = useDocsContext()

  return (
    <div class="w-full">
      <For each={docs.nav}>{(item) => <NavSection item={item} />}</For>
    </div>
  )
}

function NavSection(props: { item: NavItem }) {
  const pageContext = usePageContext()
  const pathname = () => stripBasePath(pageContext.urlParsed?.pathname || "/")

  return (
    <div class="mb-4">
      <Show
        when={props.item.items}
        fallback={
          <Show when={props.item.path}>
            {(path) => (
                  <a
                    href={withBasePath(path())}
                    class={cn(
                      "flex w-full items-center rounded-md px-2 py-1.5 font-medium text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                      isActive(pathname(), path()) && "bg-accent text-accent-foreground"
                )}
              >
                {props.item.label}
              </a>
            )}
          </Show>
        }
      >
        {(items) => (
          <>
            <h4 class="mb-1 px-2 py-1 font-semibold text-sm">{props.item.label}</h4>
            <div class="space-y-1">
              <For each={items()}>
                {(child) => (
                  <Show when={child.path}>
                    {(path) => (
                      <a
                        href={withBasePath(path())}
                        class={cn(
                          "flex w-full items-center rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                          isActive(pathname(), path()) &&
                            "bg-accent font-medium text-accent-foreground"
                        )}
                      >
                        {child.label}
                      </a>
                    )}
                  </Show>
                )}
              </For>
            </div>
          </>
        )}
      </Show>
    </div>
  )
}

function isActive(currentPath: string, navPath: string): boolean {
  if (navPath === "/") {
    return currentPath === "/"
  }
  return currentPath.startsWith(navPath)
}
