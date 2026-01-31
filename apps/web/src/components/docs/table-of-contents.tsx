import { createEffect, createSignal, For, onCleanup, Show } from "solid-js"
import { cn } from "@/utils/cn"

export interface Heading {
  level: number
  text: string
  slug: string
}

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
      const headerOffset = 80 // Account for sticky header height + some padding
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.scrollY - headerOffset

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      })
      window.history.pushState(null, "", `#${slug}`)
    }
  }

  return (
    <div class={cn("space-y-1", props.class)}>
      <p class="px-3 font-medium text-sm">On this page</p>
      <Show
        when={props.headings.length > 0}
        fallback={<p class="px-3 text-muted-foreground text-sm">No headings found</p>}
      >
        <ul class="text-sm">
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
                    "flex w-full items-center border-l-2 border-transparent px-3 py-1 transition-colors hover:text-foreground hover:bg-accent",
                    activeSlug() === heading.slug
                      ? "border-l-primary bg-accent font-medium text-foreground"
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
