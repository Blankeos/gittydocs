import type { FlowProps } from "solid-js"
import { Show } from "solid-js"
import { DocsHeader } from "@/gittydocs/components/docs/docs-header"
import { DocsNav } from "@/gittydocs/components/docs/docs-nav"
import { Sidebar } from "@/gittydocs/components/docs/sidebar"
import { usePageLayout } from "@/gittydocs/hooks/use-page-layout"
import { cn } from "@/utils/cn"

export function DocsLayout(props: FlowProps) {
  const { sidebar } = usePageLayout()

  return (
    <div class="relative flex min-h-screen flex-col">
      <DocsHeader />

      <div class="flex flex-1 flex-col">
        <div
          class={cn(
            "min-h-0 flex-1 items-start",
            sidebar() &&
              "md:grid md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[288px_minmax(0,1fr)]"
          )}
        >
          <Show when={sidebar()}>
            <Sidebar>
              <DocsNav />
            </Sidebar>
          </Show>

          <div
            class={cn(
              "flex min-h-[calc(100vh-3.5rem)] min-w-0 flex-col",
              sidebar() ? "items-start" : "w-full items-stretch"
            )}
          >
            {props.children}
          </div>
        </div>
      </div>
    </div>
  )
}
