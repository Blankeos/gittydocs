import type { FlowProps } from "solid-js"
import { DocsContextProvider } from "@/gittydocs/contexts/docs.context"
import { SearchContextProvider } from "@/gittydocs/contexts/search.context"

export function DocsProvider(props: FlowProps) {
  return (
    <DocsContextProvider>
      <SearchContextProvider>{props.children}</SearchContextProvider>
    </DocsContextProvider>
  )
}
