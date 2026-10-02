"use client"

import {
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  type JSX,
  onMount,
  useContext,
} from "solid-js"
import { useDocsContext } from "@/gittydocs/contexts/docs.context"
import {
  createDocsSearch,
  createSearchEntries,
  type DocsSearchResult,
} from "@/gittydocs/lib/search-utils"

type SearchContextValue = {
  searchDocs: (query: string) => DocsSearchResult[]
  docsIndexIsReady: Accessor<boolean>
}

const SearchContext = createContext<SearchContextValue>({
  searchDocs: () => [],
  docsIndexIsReady: () => false,
})

export const useSearchContext = () => useContext(SearchContext)

type SearchContextProviderProps = {
  children: JSX.Element
}

export const SearchContextProvider = (props: SearchContextProviderProps) => {
  const docs = useDocsContext()
  const [docsIndexIsReady, setDocsIndexIsReady] = createSignal(false)
  const entries = createMemo(() => createSearchEntries(docs.pages, docs.nav))
  const searchIndex = createMemo(() => createDocsSearch(entries()))

  onMount(() => {
    searchIndex()
    setDocsIndexIsReady(true)
  })

  const searchDocs = (query: string) => searchIndex()(query)

  return (
    <SearchContext.Provider value={{ searchDocs, docsIndexIsReady }}>
      {props.children}
    </SearchContext.Provider>
  )
}
