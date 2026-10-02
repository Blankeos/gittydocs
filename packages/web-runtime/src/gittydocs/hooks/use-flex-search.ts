import { Index } from "flexsearch"
import { createSignal, onMount } from "solid-js"
import {
  createSearchSnippet,
  highlightSearchText,
  type SearchHighlightSegment,
} from "@/gittydocs/lib/search-highlights"

export const createFlexSearchIndex = <TData extends object>(
  data: TData[],
  options?: {
    /** Converts a data item into searchable text. Defaults to JSON.stringify. */
    indexerFn?: (data: TData) => string
    /** Snippets are inert text segments, never HTML. */
    highlightableTextFn?: (data: TData) => string
    /** @defaultValue true */
    returnAllOnEmpty?: boolean
    /** @defaultValue 24 */
    limit?: number
  }
) => {
  let index = new Index({ tokenize: "full" })
  const [indexIsReady, setIndexIsReady] = createSignal(false)

  onMount(() => {
    const nextIndex = new Index({ tokenize: "full" })
    data.forEach((item, position) => {
      nextIndex.add(position, options?.indexerFn?.(item) ?? JSON.stringify(item))
    })
    index = nextIndex
    setIndexIsReady(true)
  })

  type TDataWithHighlights = TData & { highlights?: SearchHighlightSegment[] }

  const search = (input: string): TDataWithHighlights[] => {
    const query = input.trim()
    const limit = options?.limit ?? 24
    if (!query)
      return options?.returnAllOnEmpty === false
        ? []
        : data.slice(0, limit).map((item) => ({ ...item }))
    if (!indexIsReady()) return []

    // FlexSearch takes plain text, not an escaped regular expression.
    return index.search(query, { limit }).map((id) => {
      const item = data[Number(id)]
      const text = options?.highlightableTextFn?.(item)
      // Do not mutate source documents or leave stale highlights behind.
      return text
        ? { ...item, highlights: highlightSearchText(createSearchSnippet(text, query), query) }
        : { ...item }
    })
  }

  return { search, indexIsReady }
}

export type CreateFlexSearchIndexResult<TData extends object> = ReturnType<
  typeof createFlexSearchIndex<TData>
>
