import { useSearchContext } from "@/gittydocs/contexts/search.context"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { createMemo, createSignal, Show } from "solid-js"
import { navigate } from "vike/client/router"

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchDialog(props: SearchDialogProps) {
  const [query, setQuery] = createSignal("")
  const [docsResults, setDocsResults] = createSignal<ReturnType<typeof searchDocs>>([])
  const { searchDocs } = useSearchContext()

  const noResults = createMemo(() => {
    return docsResults().length === 0
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
        <CommandInput 
          placeholder="Search documentation..." 
          onValueChange={handleCommandInput} 
        />
        <CommandList>
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
