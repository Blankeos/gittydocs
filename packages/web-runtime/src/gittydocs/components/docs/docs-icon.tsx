import { Dynamic } from "solid-js/web"
import {
  IconArrowUpRight,
  IconBook,
  IconCode,
  IconFile,
  IconFolder,
  IconGitHub,
  IconHash,
  IconLink,
  IconPackage,
  IconRocket,
  IconSettings,
  IconSquareTerminal,
} from "@/assets/icons"
import { cn } from "@/utils/cn"

// Lucide via iconmate (`bun run icon add --folder src/assets/icons --icon lucide:<name>`).
const docsIcons = {
  file: IconFile,
  book: IconBook,
  code: IconCode,
  terminal: IconSquareTerminal,
  folder: IconFolder,
  rocket: IconRocket,
  hash: IconHash,
  link: IconLink,
  package: IconPackage,
  settings: IconSettings,
  github: IconGitHub,
} as const

export interface DocsIconProps {
  name?: string
  class?: string
}

/** Decorative icon; the surrounding control supplies its accessible label. */
export function DocsIcon(props: DocsIconProps) {
  const name = () => props.name?.trim().toLowerCase() || "file"
  const iconClass = () => cn("size-4 shrink-0", props.class)
  const component = () => (docsIcons as Record<string, typeof IconFile>)[name()] ?? IconFile

  return <Dynamic component={component()} class={iconClass()} aria-hidden="true" />
}

/** Shared visual and screen-reader announcement for every new-tab nav link. */
export function NewTabIndicator() {
  return (
    <>
      <IconArrowUpRight class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span class="sr-only"> (opens in a new tab)</span>
    </>
  )
}
