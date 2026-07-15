import { createMemo, For } from "solid-js"

import { parseHeadingInlineContent } from "@/gittydocs/lib/heading-utils"
import { cn } from "@/utils/cn"

interface HeadingInlineContentProps {
  text: string
  class?: string
}

export function HeadingInlineContent(props: HeadingInlineContentProps) {
  const segments = createMemo(() => parseHeadingInlineContent(props.text))

  return (
    <span class={props.class}>
      <For each={segments()}>
        {(segment) =>
          segment.type === "code" ? (
            <code
              class={cn(
                "rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground",
                "not-italic"
              )}
            >
              {segment.value}
            </code>
          ) : (
            segment.value
          )
        }
      </For>
    </span>
  )
}
