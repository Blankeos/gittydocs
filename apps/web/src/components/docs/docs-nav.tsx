import { For, Show, createMemo } from "solid-js"
import { usePageContext } from "vike-solid/usePageContext"
import { useDocsContext, type NavItem } from "@/contexts/docs.context"
import { stripBasePath, withBasePath } from "@/utils/base-path"
import { cn } from "@/utils/cn"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"

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

  const hasAccordion = createMemo(() => props.item.accordion === true)

  const isGroupActive = createMemo(() => {
    if (!props.item.items) return false
    return props.item.items.some(
      (child) => child.path && isActive(pathname(), child.path)
    )
  })

  return (
    <div class="mb-1">
      <Show
        when={props.item.items}
        fallback={
          <Show when={props.item.path}>
            {(path) => (
              <a
                href={withBasePath(path())}
                class={cn(
                  "flex w-full items-center border-l-2 border-transparent px-3 py-1 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                  isActive(pathname(), path()) && "border-l-primary bg-accent font-medium text-accent-foreground"
                )}
              >
                {props.item.label}
              </a>
            )}
          </Show>
        }
      >
        {(items) => (
          <Show
            when={hasAccordion()}
            fallback={
              <div>
                <h4 class="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {props.item.label}
                </h4>
                <div>
                  <For each={items()}>
                    {(child) => (
                      <Show when={child.path}>
                        {(path) => (
                          <a
                            href={withBasePath(path())}
                            class={cn(
                              "flex w-full items-center border-l-2 border-transparent px-3 py-1 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                              isActive(pathname(), path()) &&
                                "border-l-primary bg-accent font-medium text-accent-foreground"
                            )}
                          >
                            {child.label}
                          </a>
                        )}
                      </Show>
                    )}</For>
                </div>
              </div>
            }
          >
            <Accordion
              defaultValue={isGroupActive() ? [props.item.label] : []}
              multiple
              class="border-0"
            >
              <AccordionItem value={props.item.label} class="border-0">
                <AccordionTrigger class="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:no-underline hover:text-foreground [&[data-expanded]>svg]:rotate-180">
                  {props.item.label}
                </AccordionTrigger>
                <AccordionContent class="pb-0">
                  <div class="pt-1">
                    <For each={items()}>
                      {(child) => (
                        <Show when={child.path}>
                          {(path) => (
                            <a
                              href={withBasePath(path())}
                              class={cn(
                                "flex w-full items-center border-l-2 border-transparent px-3 py-1 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                                isActive(pathname(), path()) &&
                                  "border-l-primary bg-accent font-medium text-accent-foreground"
                              )}
                            >
                              {child.label}
                            </a>
                          )}
                        </Show>
                      )}
                    </For>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Show>
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
