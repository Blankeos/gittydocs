import type { FlowProps } from "solid-js"
import { DocsHeader } from "@/components/docs/docs-header"
import { DocsNav } from "@/components/docs/docs-nav"
import { Sidebar } from "@/components/docs/sidebar"

export function DocsLayout(props: FlowProps) {
  return (
    <div class="relative flex min-h-screen flex-col">
      <DocsHeader />

      <div class="container flex-1">
        <div class="flex-1 items-start md:grid md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[288px_minmax(0,1fr)]">
          <Sidebar>
            <DocsNav />
          </Sidebar>

          <main class="relative px-4 py-6 md:px-6 lg:gap-10 lg:py-8 xl:grid xl:grid-cols-[1fr_220px] xl:px-8">
            {props.children}
          </main>
        </div>
      </div>
    </div>
  )
}
