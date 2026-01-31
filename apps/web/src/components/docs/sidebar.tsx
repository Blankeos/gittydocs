import type { JSX } from "solid-js"
import { cn } from "@/utils/cn"

interface SidebarProps {
  class?: string
  children?: JSX.Element
}

export function Sidebar(props: SidebarProps) {
  return (
    <aside
      class={cn(
        "fixed top-14 z-30 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 overflow-y-auto border-r bg-background md:sticky md:block md:w-60 lg:w-72",
        props.class
      )}
    >
      <div class="py-6 pr-4 pl-4 lg:pl-6">{props.children}</div>
    </aside>
  )
}
