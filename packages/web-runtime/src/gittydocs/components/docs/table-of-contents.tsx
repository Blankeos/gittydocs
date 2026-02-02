import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import { cn } from "@/utils/cn"
import { Collapsible } from "@/components/ui/collapsible"

export interface Heading {
  level: number
  text: string
  slug: string
}

interface TableOfContentsProps {
  headings: Heading[]
  class?: string
  variant?: "desktop" | "mobile"
}

export function TableOfContents(props: TableOfContentsProps) {
  const [activeSlug, setActiveSlug] = createSignal<string | null>(null)
  const [mobileOpen, setMobileOpen] = createSignal(false)
  let mobileRef: HTMLDivElement | undefined

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

  createEffect(() => {
    if (props.variant !== "mobile") return
    if (!mobileOpen()) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (mobileRef && target && !mobileRef.contains(target)) {
        setMobileOpen(false)
      }
    }

    window.addEventListener("pointerdown", handlePointerDown)
    onCleanup(() => window.removeEventListener("pointerdown", handlePointerDown))
  })

  const activeHeading = createMemo(() => {
    const slug = activeSlug()
    return props.headings.find((heading) => heading.slug === slug) ?? props.headings[0] ?? null
  })

  const handleClick = (e: MouseEvent, slug: string, closeMobile = false) => {
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
      setActiveSlug(slug)
      if (closeMobile) setMobileOpen(false)
    }
  }

  if (props.variant === "mobile") {
    return (
      <div ref={mobileRef} class={cn("relative", props.class)}>
        <button
          type="button"
          class="flex w-full items-center justify-between gap-2 rounded-none border-x-0 border-b border-t-0 bg-background/95 px-4 py-3 text-sm backdrop-blur"
          aria-expanded={mobileOpen()}
          aria-controls="mobile-toc-panel"
          onClick={() => setMobileOpen((open) => !open)}
        >
          <span class="flex min-w-0 items-center gap-2 text-left">
            <span class="text-muted-foreground">On this page</span>
            <span class="text-muted-foreground">&gt;</span>
            <Show when={activeHeading()} keyed>
              {(heading) => (
                <span class="min-w-0 truncate font-medium text-foreground animate-scaleIn">
                  {heading.text}
                </span>
              )}
            </Show>
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              mobileOpen() && "rotate-180"
            )}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <Collapsible
          id="mobile-toc-panel"
          role="region"
          open={mobileOpen()}
          containerClass="absolute left-0 right-0 top-full z-40"
        >
          <div class="border-x-0 border-y border-t-0 bg-popover px-2 py-2 shadow-lg">
            <ul class="max-h-[60vh] overflow-auto text-sm">
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
                      onClick={(e) => handleClick(e, heading.slug, true)}
                      aria-current={activeSlug() === heading.slug ? "true" : undefined}
                      class={cn(
                        "flex w-full items-center rounded-md px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground",
                        activeSlug() === heading.slug
                          ? "bg-accent font-medium text-accent-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {heading.text}
                    </a>
                  </li>
                )}
              </For>
            </ul>
          </div>
        </Collapsible>
      </div>
    )
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
                  aria-current={activeSlug() === heading.slug ? "true" : undefined}
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
