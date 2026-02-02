import { createMemo, For, onMount, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { usePageContext } from "vike-solid/usePageContext"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { type NavItem, useDocsContext } from "@/gittydocs/contexts/docs.context"
import { stripBasePath, withBasePath } from "@/utils/base-path"
import { cn } from "@/utils/cn"

interface AccordionState {
  openAccordions: Record<string, boolean>
}

export function DocsNav() {
  const docs = useDocsContext()
  const pageContext = usePageContext()
  const pathname = () => stripBasePath(pageContext.urlParsed?.pathname || "/")
  const navItems = createMemo(() => removeLlmsItems(docs.nav))
  const llmsEnabled = () => docs.config?.llms?.enabled !== false

  const [accordionState, setAccordionState] = createStore<AccordionState>({
    openAccordions: {},
  })

  const toggleAccordion = (label: string) => {
    setAccordionState("openAccordions", label, (prev) => !prev)
  }

  onMount(() => {
    // Initialize accordions that contain the current active link
    const initialOpen: Record<string, boolean> = {}
    navItems().forEach((item) => {
      if (item.accordion && item.items) {
        const hasActiveChild = item.items.some(
          (child) => child.path && isActive(pathname(), child.path)
        )
        if (hasActiveChild) {
          initialOpen[item.label] = true
        }
      }
    })
    setAccordionState("openAccordions", initialOpen)
  })

  return (
    <div class="w-full">
      <For each={navItems()}>
        {(item) => (
          <NavSection
            item={item}
            isOpen={accordionState.openAccordions[item.label] || false}
            onToggle={() => toggleAccordion(item.label)}
          />
        )}
      </For>
      <Show when={llmsEnabled()}>
        <div class="mt-4 border-t pt-3">
          <a
            href={withBasePath("/llms.txt")}
            data-vike="false"
            class={cn(
              "flex w-full items-center border-transparent border-l-2 px-3 py-1 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
              isActive(pathname(), "/llms.txt") &&
                "border-l-primary bg-accent font-medium text-accent-foreground"
            )}
          >
            llms.txt
          </a>
        </div>
      </Show>
    </div>
  )
}

interface NavSectionProps {
  item: NavItem
  isOpen: boolean
  onToggle: () => void
}

function NavSection(props: NavSectionProps) {
  const pageContext = usePageContext()
  const pathname = () => stripBasePath(pageContext.urlParsed?.pathname || "/")

  const hasAccordion = createMemo(() => props.item.accordion === true)

  const isGroupActive = createMemo(() => {
    if (!props.item.items) return false
    return props.item.items.some((child) => child.path && isActive(pathname(), child.path))
  })

  const accordionValue = createMemo(() => {
    return props.isOpen ? [props.item.label] : []
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
                  "flex w-full items-center border-transparent border-l-2 px-3 py-1 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                  isActive(pathname(), path()) &&
                    "border-l-primary bg-accent font-medium text-accent-foreground"
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
                <h4 class="px-3 py-1 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
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
                              "flex w-full items-center border-transparent border-l-2 px-3 py-1 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
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
              </div>
            }
          >
            <Accordion
              value={accordionValue()}
              onChange={(value) => {
                const isExpanded = value.includes(props.item.label)
                if (isExpanded !== props.isOpen) {
                  props.onToggle()
                }
              }}
              multiple
              class="border-0"
            >
              <AccordionItem value={props.item.label} class="border-0">
                <AccordionTrigger class="px-3 py-1 font-semibold text-muted-foreground text-xs uppercase tracking-wider hover:text-foreground hover:no-underline [&[data-expanded]>svg]:rotate-180">
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
                                "flex w-full items-center border-transparent border-l-2 px-3 py-1 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
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

function removeLlmsItems(items: NavItem[]): NavItem[] {
  return items
    .filter((item) => item.path !== "/llms.txt")
    .map((item) => {
      if (!item.items) return item
      const filteredItems = item.items.filter((child) => child.path !== "/llms.txt")
      return { ...item, items: filteredItems }
    })
    .filter((item) => !item.items || item.items.length > 0)
}
