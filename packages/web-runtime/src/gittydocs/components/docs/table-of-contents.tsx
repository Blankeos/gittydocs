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

    let lastActiveSlug: string | null = null
    const visibleHeadings = new Set<string>()

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleHeadings.add(entry.target.id)
          } else {
            visibleHeadings.delete(entry.target.id)
          }
        })

        // If we have visible headings, use the first one
        // Otherwise, keep the last active heading
        if (visibleHeadings.size > 0) {
          // Find the first visible heading in document order
          const firstVisible = headings.find((h) => visibleHeadings.has(h.slug))
          if (firstVisible) {
            lastActiveSlug = firstVisible.slug
            setActiveSlug(firstVisible.slug)
          }
        } else if (lastActiveSlug) {
          // Keep the last active heading when scrolling past all headings
          setActiveSlug(lastActiveSlug)
        }
      },
      {
        rootMargin: "-80px 0px -40%",
        threshold: [0, 0.25, 0.5, 0.75, 1],
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
                    "flex w-full items-center border-transparent border-l-2 px-3 py-1 transition-colors hover:bg-accent hover:text-accent-foreground",
                    activeSlug() === heading.slug
                      ? "border-l-primary bg-accent font-medium text-accent-foreground"
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
