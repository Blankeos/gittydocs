import { createMemo, createSignal, Show } from "solid-js"
import { navigate } from "vike/client/router"
import { IconMoonDuo, IconSunDuo } from "@/assets/icons"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useSearchContext } from "@/gittydocs/contexts/search.context"

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onToggleTheme?: () => void
  themeLabel?: string
  githubUrl?: string | null
}

export function SearchDialog(props: SearchDialogProps) {
  const [query, setQuery] = createSignal("")
  const [docsResults, setDocsResults] = createSignal<ReturnType<typeof searchDocs>>([])
  const { searchDocs } = useSearchContext()

  const noResults = createMemo(() => {
    return docsResults().length === 0
  })

  const hasQuickActions = createMemo(() => {
    return Boolean(props.onToggleTheme || props.githubUrl)
  })

  function handleCommandInput(value: string) {
    setQuery(value)

    if (!value) {
      clearResults()
    } else {
      const _docsResults = searchDocs(value)
      setDocsResults(_docsResults)
    }
  }

  function clearResults() {
    setQuery("")
    setDocsResults([])
  }

  return (
    <CommandDialog open={props.open} onOpenChange={props.onOpenChange}>
      <Command shouldFilter={false}>
        <CommandInput placeholder="Search documentation..." onValueChange={handleCommandInput} />
        <CommandList>
          <Show when={query().length === 0 && hasQuickActions()}>
            <CommandGroup heading="Quick actions" class="md:hidden">
              <Show when={props.onToggleTheme && props.themeLabel}>
                <CommandItem
                  onSelect={() => {
                    props.onToggleTheme?.()
                    props.onOpenChange(false)
                    clearResults()
                  }}
                  class="gap-2"
                >
                  <Show
                    when={props.themeLabel?.toLowerCase().includes("dark")}
                    fallback={<IconSunDuo class="h-4 w-4" />}
                  >
                    <IconMoonDuo class="h-4 w-4" />
                  </Show>
                  <span>{props.themeLabel}</span>
                </CommandItem>
              </Show>
              <Show when={props.githubUrl}>
                {(url) => (
                  <CommandItem
                    onSelect={() => {
                      if (typeof window !== "undefined") {
                        window.open(url(), "_blank", "noopener,noreferrer")
                      }
                      props.onOpenChange(false)
                      clearResults()
                    }}
                    class="gap-2"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      class="h-4 w-4"
                    >
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    <span>Open GitHub</span>
                  </CommandItem>
                )}
              </Show>
            </CommandGroup>
          </Show>

          <Show when={noResults() && query().length > 0}>
            <CommandEmpty>No results found.</CommandEmpty>
          </Show>

          <Show when={query().length === 0}>
            <CommandEmpty>Type to search documentation...</CommandEmpty>
          </Show>

          <Show when={docsResults().length > 0}>
            <CommandGroup heading="Documentation">
              {docsResults().map((doc) => (
                <CommandItem
                  onSelect={() => {
                    const path = doc.slugAsParams === "" ? "/" : `/${doc.slugAsParams}`
                    navigate(path)
                    props.onOpenChange(false)
                    clearResults()
                  }}
                  class="flex flex-col items-start justify-start text-start"
                >
                  <span class="text-start">{doc.title}</span>
                  <Show when={doc.highlights && doc.highlights.length > 0}>
                    <div
                      class="line-clamp-2 text-muted-foreground text-xs"
                      innerHTML={`...${doc.highlights?.join("...")}...`}
                    />
                  </Show>
                </CommandItem>
              ))}
            </CommandGroup>
          </Show>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
