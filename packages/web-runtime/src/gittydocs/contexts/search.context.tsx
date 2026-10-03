"use client"

import { createContext, createMemo, type JSX, useContext } from "solid-js"
import { useDocsContext } from "@/gittydocs/contexts/docs.context"
import { createDocsSearch, type DocsSearchGroup } from "@/gittydocs/lib/search-utils"

type SearchContextValue = {
  searchDocs: (query: string) => DocsSearchGroup[]
}

const SearchContext = createContext<SearchContextValue>({
  searchDocs: () => [],
})

export const useSearchContext = () => useContext(SearchContext)

type SearchContextProviderProps = {
  children: JSX.Element
}

export const SearchContextProvider = (props: SearchContextProviderProps) => {
  const docs = useDocsContext()
  const searchIndex = createMemo(() => createDocsSearch(docs.pages, docs.navigation))

  const searchDocs = (query: string) => searchIndex()(query)

  return <SearchContext.Provider value={{ searchDocs }}>{props.children}</SearchContext.Provider>
}
