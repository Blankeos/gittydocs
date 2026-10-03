import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js"
import { createTocCoordinator } from "../lib/toc-coordinator"
import { createTocState } from "../lib/toc-state"

export interface TableOfContentsController {
  activeSlug: Accessor<string | null>
  navigate: (slug: string) => boolean
}

export function useTableOfContents(options: {
  routePath: Accessor<string>
  headings: Accessor<readonly { slug: string }[]>
  hash?: Accessor<string | undefined>
}): TableOfContentsController {
  // Fragments are not sent to the server. Keep the initial client render identical;
  // the browser coordinator reads the authoritative hash in the post-hydration effect.
  const [activeSlug, setActiveSlug] = createSignal(
    createTocState(options.headings().map((heading) => heading.slug)).activeSlug
  )
  let coordinator: ReturnType<typeof createTocCoordinator> | undefined

  createEffect(() => {
    // Route and router hash changes recreate the page-scoped coordinator (including its pin).
    options.routePath()
    const slugs = options.headings().map((heading) => heading.slug)
    options.hash?.()
    if (slugs.length === 0) {
      setActiveSlug(null)
      return
    }
    if (typeof window === "undefined" || typeof document === "undefined") return
    coordinator = createTocCoordinator({
      slugs,
      window,
      document,
      onActiveChange: setActiveSlug,
    })
    onCleanup(() => {
      coordinator?.dispose()
      coordinator = undefined
    })
  })

  return { activeSlug, navigate: (slug) => coordinator?.navigate(slug) ?? false }
}
