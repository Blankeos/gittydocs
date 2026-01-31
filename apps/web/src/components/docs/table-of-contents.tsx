import { createEffect, createSignal, For, onCleanup, Show } from "solid-js"
import type { Heading } from "@/lib/gittydocs"
import { cn } from "@/utils/cn"

interface TableOfContentsProps {
  headings: Heading[]
  class?: string
}

export function TableOfContents(props: TableOfContentsProps) {
  const [activeSlug, setActiveSlug] = createSignal<string | null>(null)

  createEffect(() => {
    const headings = props.headings
    if (headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSlug(entry.target.id)
          }
        })
      },
      {
        rootMargin: "-100px 0px -66%",
        threshold: 0,
      }
    )

    // Observe all heading elements
    headings.forEach((heading) => {
      const element = document.getElementById(heading.slug)
      if (element) {
        observer.observe(element)
      }
    })

    onCleanup(() => {
      observer.disconnect()
    })
  })

  const handleClick = (e: MouseEvent, slug: string) => {
    e.preventDefault()
    const element = document.getElementById(slug)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
      window.history.pushState(null, "", `#${slug}`)
    }
  }

  return (
    <div class={cn("space-y-2", props.class)}>
      <p class="font-medium text-sm">On this page</p>
      <Show
        when={props.headings.length > 0}
        fallback={<p class="text-muted-foreground text-sm">No headings found</p>}
      >
        <ul class="space-y-2.5 text-sm">
          <For each={props.headings}>
            {(heading) => (
              <li
                class={cn(
                  "transition-colors",
                  heading.level === 1 && "font-medium",
                  heading.level > 2 && "ml-3"
                )}
              >
                <a
                  href={`#${heading.slug}`}
                  onClick={(e) => handleClick(e, heading.slug)}
                  class={cn(
                    "block py-0.5 transition-colors hover:text-foreground",
                    activeSlug() === heading.slug
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {heading.text}
                </a>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  )
}
