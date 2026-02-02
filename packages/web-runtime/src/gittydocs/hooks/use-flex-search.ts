import { Index } from "flexsearch"
import { createMemo, createSignal, onMount } from "solid-js"

function replaceTextWithMarker(text: string, match: string) {
  // create dynamic regex
  const regex = new RegExp(match, "gi")
  // preserves the text casing
  return text.replace(regex, (value: string) => `<mark>${value}</mark>`)
}

function getHighlightMatches(text: string, searchTerm: string, limit = 1) {
  // create dynamic regex
  const regex = new RegExp(searchTerm, "gi")
  // word indexes
  const indexes = []
  // matches count
  let matches = 0
  // current match in loop
  let match: RegExpExecArray | null = null

  while (matches < limit) {
    match = regex.exec(text)
    if (!match) break
    indexes.push(match.index)
    matches++
  }

  // take the word index...
  const matcerh = indexes.map((index) => {
    // go back 20 characters
    const start = index - 20
    // go forward 80 characters
    const end = index + 80
    // extract the text
    const excerpt = text.substring(start, end).trim()
    // return excerpt with marker
    return `${replaceTextWithMarker(excerpt, searchTerm)}`
  })

  return matcerh
}

export const createFlexSearchIndex = <TData>(
  data: TData[],
  options?: {
    /**
     * Function that converts your data item into a searchable string for the FlexSearch index.
     * Whatever string here will be the 'searchable' string.
     * @defaultValue (data) => JSON.stringify(data)
     */
    indexerFn?: (data: TData) => string
    /** @defaultValue undefined. There will be no `highlights?: string[]` in the return type of search. */
    highlightableTextFn?: (data: TData) => string
    /** @defaultValue true */
    returnAllOnEmpty?: boolean
  }
) => {
  /** Cached Prop: Used for search. So it doesn't re-run. */
  const returnAllOnEmpty = createMemo(
    () => options?.returnAllOnEmpty ?? true,
    options?.returnAllOnEmpty
  )

  /** Cached Prop: Used for search. So it doesn't re-run. */

  let index = new Index({ tokenize: "full" })
  const [indexIsReady, setIndexIsReady] = createSignal(false)

  // onMount: Create Index
  onMount(() => {
    console.debug(`Creating index... (If this runs a lot, there's definitely a bug).`)
    if (!data.length) return
    const _index = new Index({ tokenize: "full" })

    // data.forEach((item) => index.add(item));
    data.forEach((_doc, i) => {
      const _docIndex = options?.indexerFn?.(_doc) ?? JSON.stringify(_doc)
      _index.add(i, _docIndex)
    })

    index = _index
    setIndexIsReady(true)
    console.debug(`Index is ready!`)
  })

  type Prettify<T> = {
    [K in keyof T]: T[K]
  } & {}

  type TDataWithHighlights = Prettify<
    TData & {
      /** Highlights are only present if you use highlightableText in options. */
      highlights?: string[]
    }
  >

  const search = (query: string) => {
    if (!indexIsReady()) {
      if (returnAllOnEmpty()) return data as TDataWithHighlights[]
      return []
    }

    const match = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    if (!match) {
      if (returnAllOnEmpty()) return data as TDataWithHighlights[]
      return []
    }

    const results: TDataWithHighlights[] = []

    const resultIndices = index.search(match)
    resultIndices.forEach((index) => {
      const _dataItem = data[index as number] as unknown as TDataWithHighlights

      const highlightableText = options?.highlightableTextFn?.(_dataItem) ?? undefined

      if (highlightableText) {
        const highlights = getHighlightMatches(highlightableText, query, 3)
        _dataItem["highlights"] = highlights as any // Should be good
      }

      results.push(_dataItem)
    })

    return results
  }

  return {
    search,
    indexIsReady,
  }
}

export type CreateFlexSearchIndexResult<TData> = ReturnType<typeof createFlexSearchIndex<TData>>
