"use client"

import { type Docs, docs } from "@velite"
import { type Accessor, createContext, type JSX, useContext } from "solid-js"
import { type CreateFlexSearchIndexResult, createFlexSearchIndex } from "@/gittydocs/hooks/use-flex-search"

type SearchContextValue = {
  searchDocs: CreateFlexSearchIndexResult<Docs>["search"]
  docsIndexIsReady: Accessor<boolean>
}

const SearchContext = createContext<SearchContextValue>({
  searchDocs: () => [],
  docsIndexIsReady: () => false,
} as SearchContextValue)

export const useSearchContext = () => useContext(SearchContext)

type SearchContextProviderProps = {
  children: JSX.Element
}

export const SearchContextProvider = (props: SearchContextProviderProps) => {
  const { search: searchDocs, indexIsReady: docsIndexIsReady } = createFlexSearchIndex(docs, {
    indexerFn: (data) => {
      return `${data.title} ${data.rawText}`
    },
    highlightableTextFn: (data) => {
      return data.rawText
    },
  })

  return (
    <SearchContext.Provider
      value={{
        searchDocs,
        docsIndexIsReady,
      }}
    >
      {props.children}
    </SearchContext.Provider>
  )
}
