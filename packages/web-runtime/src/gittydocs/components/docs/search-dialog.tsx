import { createEffect, createMemo, createSignal, For, Show } from "solid-js"
import { navigate } from "vike/client/router"
import { IconMoon, IconSun } from "@/assets/icons"
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { DocsIcon, NewTabIndicator } from "@/gittydocs/components/docs/docs-icon"
import { useSearchContext } from "@/gittydocs/contexts/search.context"
import { isExternalHref, opensInNewTab } from "@/gittydocs/lib/nav-utils"
import type { DocsSearchResult } from "@/gittydocs/lib/search-utils"
import { withBasePath } from "@/utils/base-path"

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onToggleTheme?: () => void
  themeLabel?: string
  githubUrl?: string | null
}

export function SearchDialog(props: SearchDialogProps) {
  const [query, setQuery] = createSignal("")
  const { searchDocs } = useSearchContext()
  const groups = createMemo(() => searchDocs(query()))
  const resultCount = createMemo(() =>
    groups().reduce((count, group) => count + group.results.length, 0)
  )
  const isSearching = createMemo(() => query().trim().length > 0)
  const hasQuickActions = createMemo(() => Boolean(props.onToggleTheme || props.githubUrl))

  createEffect(() => {
    if (!props.open) setQuery("")
  })

  function closeDialog() {
    props.onOpenChange(false)
    setQuery("")
  }

  async function selectResult(result: DocsSearchResult) {
    closeDialog()
    const external = isExternalHref(result.href)
    const href = external ? result.href : withBasePath(result.href)
    if (external || (result.navItem && opensInNewTab(result.navItem))) {
      window.open(href, "_blank", "noopener,noreferrer")
      return
    }
    await navigate(href)
    if (result.heading) {
      // Also handle selecting an anchor on the current route. The initial hash
      // and event let the ToC initialize its active item after route hydration.
      requestAnimationFrame(() => {
        const heading = document.getElementById(result.heading!.slug)
        heading?.scrollIntoView({ block: "start" })
        window.dispatchEvent(new Event("hashchange"))
      })
    }
  }

  return (
    <CommandDialog
      open={props.open}
      onOpenChange={(open) => {
        props.onOpenChange(open)
        if (!open) setQuery("")
      }}
      title="Search documentation"
      description="Find documentation pages and headings. Use the arrow keys to move and Enter to open a result."
      commandProps={{ shouldFilter: false, loop: true, label: "Search documentation" }}
    >
      <CommandInput
        placeholder="Search documentation…"
        aria-label="Search documentation"
        value={query()}
        onValueChange={setQuery}
        onClose={closeDialog}
      />
      <CommandList class="px-0 py-1">
        <Show when={!isSearching() && hasQuickActions()}>
          <CommandGroup heading="Quick actions">
            <Show when={props.onToggleTheme}>
              <CommandItem
                value="action:toggle-theme"
                onSelect={() => {
                  props.onToggleTheme?.()
                  closeDialog()
                }}
                class="gap-2 px-3 py-1.5"
              >
                <span
                  aria-hidden="true"
                  class="flex size-7 shrink-0 items-center justify-center rounded-none border bg-background text-muted-foreground"
                >
                  <Show
                    when={props.themeLabel?.toLowerCase().includes("dark")}
                    fallback={<IconSun class="size-4" />}
                  >
                    <IconMoon class="size-4" />
                  </Show>
                </span>
                <span>{props.themeLabel || "Toggle theme"}</span>
              </CommandItem>
            </Show>
            <Show when={props.githubUrl}>
              {(url) => (
                <CommandItem
                  value="action:open-github"
                  onSelect={() => {
                    window.open(url(), "_blank", "noopener,noreferrer")
                    closeDialog()
                  }}
                  class="gap-2 px-3 py-1.5"
                >
                  <span
                    aria-hidden="true"
                    class="flex size-7 shrink-0 items-center justify-center rounded-none border bg-background text-muted-foreground"
                  >
                    <DocsIcon name="github" class="size-4" />
                  </span>
                  <span>Open GitHub</span>
                  <span class="ml-auto inline-flex">
                    <NewTabIndicator />
                  </span>
                </CommandItem>
              )}
            </Show>
          </CommandGroup>
        </Show>

        <Show when={resultCount() === 0}>
          <div role="status" class="px-3 py-6 text-center text-muted-foreground text-sm">
            <Show when={isSearching()} fallback="No documentation pages available yet.">
              No results for <span class="font-medium text-foreground">“{query().trim()}”</span>.
              <p class="mt-1 text-xs">Try a page title, heading, or a shorter phrase.</p>
            </Show>
          </div>
        </Show>

        <For each={groups()}>
          {(group) => (
            <CommandGroup heading={group.label}>
              <For each={group.results}>
                {(result) => (
                  <CommandItem
                    value={result.id}
                    onSelect={() => void selectResult(result)}
                    class="gap-2 px-3 py-1.5 text-start"
                  >
                    <span
                      aria-hidden="true"
                      class="flex size-8 shrink-0 items-center justify-center rounded-none border bg-background text-muted-foreground"
                    >
                      <Show
                        when={result.kind === "heading"}
                        fallback={<DocsIcon name={result.icon} class="size-4" />}
                      >
                        <span class="font-mono text-base">#</span>
                      </Show>
                    </span>
                    <div class="min-w-0 flex-1">
                      <div class="truncate font-medium text-sm">{result.title}</div>
                      <div class="mt-0.5 truncate text-muted-foreground text-xs">
                        {result.context}
                      </div>
                      <Show when={result.highlights.length > 0 && isSearching()}>
                        <p class="mt-1 line-clamp-2 break-words text-muted-foreground text-xs leading-relaxed">
                          <For each={result.highlights}>
                            {(segment) => (
                              <Show when={segment.matched} fallback={segment.text}>
                                <mark class="rounded-sm bg-accent px-0.5 font-medium text-accent-foreground">
                                  {segment.text}
                                </mark>
                              </Show>
                            )}
                          </For>
                        </p>
                      </Show>
                    </div>
                    <span class="sr-only">{result.kind === "heading" ? "Heading" : "Page"}</span>
                  </CommandItem>
                )}
              </For>
            </CommandGroup>
          )}
        </For>
      </CommandList>
      <div class="flex items-center justify-between gap-3 border-t bg-muted/30 px-3 py-2 text-muted-foreground text-xs">
        <div aria-hidden="true" class="flex items-center gap-3">
          <span class="flex items-center gap-1.5">
            <kbd class="rounded border bg-background px-1 font-mono text-[10px]">↑</kbd>
            <kbd class="rounded border bg-background px-1 font-mono text-[10px]">↓</kbd>
            <span class="hidden sm:inline">Navigate</span>
          </span>
          <span class="flex items-center gap-1.5">
            <kbd class="rounded border bg-background px-1 font-mono text-[10px]">↵</kbd>
            Open
          </span>
        </div>
        <span role="status" aria-live="polite" aria-atomic="true">
          {resultCount()}{" "}
          {isSearching()
            ? resultCount() === 1
              ? "result"
              : "results"
            : resultCount() === 1
              ? "page"
              : "pages"}
        </span>
      </div>
    </CommandDialog>
  )
}
