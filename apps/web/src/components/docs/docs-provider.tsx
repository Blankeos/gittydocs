import type { FlowProps } from "solid-js"
import { DocsContextProvider } from "@/contexts/docs.context"
import { SearchContextProvider } from "@/contexts/search.context"

export function DocsProvider(props: FlowProps) {
  return (
    <DocsContextProvider>
      <SearchContextProvider>
        {props.children}
      </SearchContextProvider>
    </DocsContextProvider>
  )
}
