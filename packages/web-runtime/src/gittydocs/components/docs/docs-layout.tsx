import type { FlowProps } from "solid-js"
import { DocsHeader } from "@/gittydocs/components/docs/docs-header"
import { DocsNav } from "@/gittydocs/components/docs/docs-nav"
import { Sidebar } from "@/gittydocs/components/docs/sidebar"

export function DocsLayout(props: FlowProps) {
  return (
    <div class="relative flex min-h-screen flex-col">
      <DocsHeader />

      <div class="flex flex-1 flex-col">
        <div class="min-h-0 flex-1 items-start md:grid md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[288px_minmax(0,1fr)]">
          <Sidebar>
            <DocsNav />
          </Sidebar>

          <div class="flex min-h-[calc(100vh-3.5rem)] flex-col items-start">{props.children}</div>
        </div>
      </div>
    </div>
  )
}
