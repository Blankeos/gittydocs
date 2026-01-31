import { createEffect, createSignal, For, Show } from "solid-js"
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog"
import type { SearchResult } from "@/lib/gittydocs"
import { useDocs } from "@/lib/gittydocs"
import { withBasePath } from "@/utils/base-path"
import { cn } from "@/utils/cn"

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchDialog(props: SearchDialogProps) {
  const docs = useDocs()
  const [query, setQuery] = createSignal("")
  const [results, setResults] = createSignal<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = createSignal(0)

  createEffect(() => {
    const q = query()
    if (q.length >= 2) {
      const searchResults = docs.searchIndex.search(q)
      setResults(searchResults)
      setSelectedIndex(0)
    } else {
      setResults([])
    }
  })

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < results().length - 1 ? prev + 1 : prev))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const result = results()[selectedIndex()]
      if (result) {
        // Navigate using window.location for simplicity
        window.location.href = withBasePath(result.routePath)
        props.onOpenChange(false)
        setQuery("")
      }
    } else if (e.key === "Escape") {
      props.onOpenChange(false)
    }
  }

  const handleSelect = (result: SearchResult) => {
    window.location.href = withBasePath(result.routePath)
    props.onOpenChange(false)
    setQuery("")
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent class="gap-0 overflow-hidden p-0 sm:max-w-[550px]">
        <DialogHeader class="border-b px-4 py-3 pr-12">
          <div class="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-4 w-4 text-muted-foreground"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Search documentation..."
              class="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              autofocus
            />
            <kbd class="hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-medium font-mono text-[10px] text-muted-foreground sm:inline-flex">
              <span>ESC</span>
            </kbd>
          </div>
        </DialogHeader>

        <div class="max-h-[300px] overflow-y-auto py-2">
          <Show
            when={query().length >= 2}
            fallback={
              <div class="px-4 py-8 text-center text-muted-foreground text-sm">
                Type to search documentation...
              </div>
            }
          >
            <Show
              when={results().length > 0}
              fallback={
                <div class="px-4 py-8 text-center text-muted-foreground text-sm">
                  No results found for "{query()}"
                </div>
              }
            >
              <For each={results()}>
                {(result, index) => (
                  <button
                    type="button"
                    onClick={() => handleSelect(result)}
                    class={cn(
                      "w-full px-4 py-2 text-left transition-colors hover:bg-accent",
                      selectedIndex() === index() && "bg-accent"
                    )}
                    onMouseEnter={() => setSelectedIndex(index())}
                  >
                    <div class="font-medium text-sm">{result.title}</div>
                    <div class="line-clamp-1 text-muted-foreground text-xs">{result.snippet}</div>
                  </button>
                )}
              </For>
            </Show>
          </Show>
        </div>

        <Show when={results().length > 0}>
          <div class="flex items-center justify-between border-t px-4 py-2 text-muted-foreground text-xs">
            <div class="flex items-center gap-2">
              <span>Use </span>
              <kbd class="inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-medium font-mono text-[10px]">
                ↑↓
              </kbd>
              <span>to navigate</span>
              <kbd class="inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-medium font-mono text-[10px]">
                ↵
              </kbd>
              <span>to select</span>
            </div>
            <div>{results().length} results</div>
          </div>
        </Show>
      </DialogContent>
    </Dialog>
  )
}
