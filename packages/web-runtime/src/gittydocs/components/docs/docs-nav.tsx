import * as AccordionPrimitive from "@kobalte/core/accordion"
import { createEffect, createMemo, For, on, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { usePageContext } from "vike-solid/usePageContext"
import { Accordion, AccordionItem } from "@/components/ui/accordion"
import { type NavItem, useDocsContext } from "@/gittydocs/contexts/docs.context"
import {
  createDocsNavigation,
  formatVersionLabel,
  isExternalHref,
  isInternalHref,
  isSafeNavHref,
  normalizeNavPath,
  opensInNewTab,
} from "@/gittydocs/lib/nav-utils"
import { withBasePath } from "@/utils/base-path"
import { cn } from "@/utils/cn"
import { DocsIcon, NewTabIndicator } from "./docs-icon"

interface DocsNavProps {
  onNavigate?: () => void
}

interface NavBranch {
  item: NavItem
  id: string
  children: NavBranch[]
}

export function DocsNav(props: DocsNavProps = {}) {
  const docs = useDocsContext()
  const pageContext = usePageContext()
  const current = createMemo(() => docs.navigation.resolve(pageContext.urlParsed?.pathname || "/"))
  const pathname = () => current().routePath
  const footerItems = createMemo(
    () => createDocsNavigation([], docs.config?.navFooter ?? [], import.meta.env.BASE_URL).items
  )
  const branches = createMemo(() => buildBranches(docs.navigation.items))
  const activeTrail = () => current().trail
  const llmsEnabled = () => docs.config?.llms?.enabled !== false
  const version = () => docs.config?.site?.version

  const initialOpen: Record<string, boolean> = {}
  const initiallyActive = new Set(activeTrail())
  visitBranches(branches(), (branch) => {
    if (branch.item.accordion) {
      initialOpen[branch.id] = branch.item.defaultOpen === true || initiallyActive.has(branch.item)
    }
  })
  const [openBranches, setOpenBranches] = createStore(initialOpen)

  // Only route/nav changes open active ancestors. Reading/toggling the store
  // must not retrigger this effect and undo a user's manual collapse.
  createEffect(
    on([pathname, branches], () => {
      const active = new Set(activeTrail())
      visitBranches(branches(), (branch) => {
        if (!branch.item.accordion) return
        if (active.has(branch.item)) {
          setOpenBranches(branch.id, true)
        } else if (openBranches[branch.id] === undefined) {
          setOpenBranches(branch.id, branch.item.defaultOpen === true)
        }
      })
    })
  )

  return (
    <div class="flex min-h-full w-full flex-1 flex-col">
      <div class="flex flex-col">
        <For each={branches()}>
          {(branch, index) => (
            <div
              style={{ "margin-top": index() > 0 ? "var(--docs-nav-section-gap, 1.25rem)" : "0" }}
            >
              <NavSection
                branch={branch}
                level={0}
                indentDepth={0}
                pathname={pathname()}
                activeTrail={activeTrail()}
                openBranches={openBranches}
                onOpenChange={(id, open) => setOpenBranches(id, open)}
                onNavigate={props.onNavigate}
              />
            </div>
          )}
        </For>
      </div>
      <Show when={llmsEnabled() || footerItems().length > 0 || version()}>
        <div class="mt-auto pt-4" data-docs-nav-footer>
          <div class="border-t pt-3">
            <Show when={llmsEnabled()}>
              <NavLink
                item={{ label: "llms.txt", path: "/llms.txt", icon: "file", newTab: true }}
                active={pathname() === "/llms.txt"}
                onNavigate={props.onNavigate}
              />
            </Show>
            <For each={footerItems()}>
              {(item) => (
                <NavLink
                  item={item}
                  active={!!item.path && normalizeNavPath(item.path) === pathname()}
                  onNavigate={props.onNavigate}
                />
              )}
            </For>
            <Show when={version()}>
              {(value) => (
                <p
                  class="mt-1 pr-3 text-muted-foreground text-xs"
                  style={{ "padding-left": "calc(.75rem + 2px)" }}
                >
                  <span class="sr-only">Version </span>
                  {formatVersionLabel(value())}
                </p>
              )}
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}

interface NavSectionProps {
  branch: NavBranch
  level: number
  indentDepth: number
  pathname: string
  activeTrail: NavItem[]
  openBranches: Record<string, boolean>
  onOpenChange: (id: string, open: boolean) => void
  onNavigate?: () => void
}

function NavSection(props: NavSectionProps) {
  const docs = useDocsContext()
  const item = () => props.branch.item
  const headingItem = createMemo(() => {
    if (item().path) return item()
    const path = docs.navigation.destination(item())
    return path ? { ...item(), path } : item()
  })
  const isGroup = () => props.branch.children.length > 0
  const isActive = () =>
    !!item().path && docs.navigation.resolve(item().path!).routePath === props.pathname
  const isOpen = () => props.openBranches[props.branch.id] === true
  const indent = () => `calc(.75rem + ${props.indentDepth} * var(--docs-nav-indent, .75rem))`
  // Match item row geometry; only text size and muted color distinguish groups.
  const headingClass = () =>
    "flex min-h-7 min-w-0 flex-1 items-center gap-2 border-transparent border-l-2 px-3 py-1 font-normal text-[13px] text-muted-foreground leading-5 group-hover/nav-heading:text-accent-foreground"

  const heading = () => (
    <Show
      when={headingItem().path}
      fallback={
        <span class={headingClass()} style={{ "padding-left": indent() }}>
          <Show when={item().icon}>
            <DocsIcon name={item().icon} />
          </Show>
          <span class="min-w-0 break-words">{item().label}</span>
        </span>
      }
    >
      <NavLink
        item={headingItem()}
        active={isActive()}
        groupHeading={item().accordion === true}
        class={headingClass()}
        indentDepth={props.indentDepth}
        onNavigate={props.onNavigate}
      />
    </Show>
  )

  const children = () => (
    <div>
      <For each={props.branch.children}>
        {(branch) => (
          <NavSection
            branch={branch}
            level={props.level + 1}
            indentDepth={props.indentDepth + 1}
            pathname={props.pathname}
            activeTrail={props.activeTrail}
            openBranches={props.openBranches}
            onOpenChange={props.onOpenChange}
            onNavigate={props.onNavigate}
          />
        )}
      </For>
    </div>
  )

  return (
    <Show
      when={isGroup()}
      fallback={
        <Show when={item().path}>
          <NavLink
            item={item()}
            active={isActive()}
            indentDepth={props.indentDepth}
            onNavigate={props.onNavigate}
          />
        </Show>
      }
    >
      <Show
        when={item().accordion === true}
        fallback={
          <div>
            <div class="flex items-center">{heading()}</div>
            {children()}
          </div>
        }
      >
        <Accordion
          value={isOpen() ? [props.branch.id] : []}
          onChange={(value: string[]) =>
            props.onOpenChange(props.branch.id, value.includes(props.branch.id))
          }
          multiple
          class="border-0"
        >
          <AccordionItem value={props.branch.id} class="border-0">
            <AccordionPrimitive.Header
              as="div"
              class="group/nav-heading flex items-center transition-colors hover:bg-accent"
              classList={{ "bg-accent": isActive() }}
            >
              <Show
                when={headingItem().path}
                fallback={
                  <AccordionPrimitive.Trigger
                    class={cn(
                      headingClass(),
                      "w-full justify-between bg-transparent text-left transition-[color] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    )}
                    style={{ "padding-left": indent() }}
                  >
                    <span class="flex min-w-0 items-center gap-2">
                      <Show when={item().icon}>
                        <DocsIcon name={item().icon} />
                      </Show>
                      <span class="min-w-0 break-words">{item().label}</span>
                    </span>
                    <NavChevron open={isOpen()} />
                  </AccordionPrimitive.Trigger>
                }
              >
                {heading()}
                <AccordionPrimitive.Trigger
                  class="flex min-h-7 w-8 shrink-0 items-center justify-center self-stretch bg-transparent text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  style={{ "background-color": "transparent", transition: "none" }}
                  aria-label={`${isOpen() ? "Collapse" : "Expand"} ${item().label} section`}
                >
                  <NavChevron open={isOpen()} />
                </AccordionPrimitive.Trigger>
              </Show>
            </AccordionPrimitive.Header>
            <AccordionPrimitive.Content class="animate-accordion-up overflow-hidden data-[expanded]:animate-accordion-down motion-reduce:animate-none">
              {children()}
            </AccordionPrimitive.Content>
          </AccordionItem>
        </Accordion>
      </Show>
    </Show>
  )
}

function NavLink(props: {
  item: NavItem
  active?: boolean
  groupHeading?: boolean
  class?: string
  indentDepth?: number
  onNavigate?: () => void
}) {
  const path = () => props.item.path?.trim() || "/"
  const newTab = () => opensInNewTab(props.item)
  const internal = () => isInternalHref(path())
  const href = () => (internal() ? withBasePath(path()) : path())

  return (
    <Show when={!props.item.path || isSafeNavHref(props.item.path)}>
      <a
        href={href()}
        target={newTab() ? "_blank" : undefined}
        rel={newTab() || isExternalHref(path()) ? "noopener noreferrer" : undefined}
        data-vike={
          !internal() || newTab() || normalizeNavPath(path()) === "/llms.txt" ? "false" : undefined
        }
        aria-current={props.active ? "page" : undefined}
        style={{
          "padding-left": `calc(.75rem + ${props.indentDepth ?? 0} * var(--docs-nav-indent, .75rem))`,
          "background-color": props.groupHeading ? "transparent" : undefined,
        }}
        onClick={() => props.onNavigate?.()}
        class={cn(
          "flex min-h-7 w-full min-w-0 items-center gap-2 border-transparent border-l-2 px-3 py-1 text-sm hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          props.groupHeading
            ? "bg-transparent transition-[color]"
            : "transition-colors hover:bg-accent",
          props.class,
          props.active && "border-l-primary font-medium text-accent-foreground",
          props.active && !props.groupHeading && "bg-accent"
        )}
      >
        <Show when={props.item.icon}>
          <DocsIcon name={props.item.icon} />
        </Show>
        <span class="min-w-0 flex-1 break-words">{props.item.label}</span>
        <Show when={newTab()}>
          <NewTabIndicator />
        </Show>
      </a>
    </Show>
  )
}

function buildBranches(items: NavItem[], parentId = "nav"): NavBranch[] {
  return items.map((item, index) => {
    const id = `${parentId}.${index}`
    return { item, id, children: buildBranches(item.items || [], id) }
  })
}

function visitBranches(branches: NavBranch[], visit: (branch: NavBranch) => void) {
  for (const branch of branches) {
    visit(branch)
    visitBranches(branch.children, visit)
  }
}

function NavChevron(props: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none"
      classList={{ "rotate-180": props.open }}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
