import type { FlowProps } from "solid-js"
import { createDocsStore, DocsContext, initializeDocs } from "@/lib/gittydocs"

export function DocsProvider(props: FlowProps) {
  const store = createDocsStore()

  initializeDocs(store)

  return <DocsContext.Provider value={store}>{props.children}</DocsContext.Provider>
}
