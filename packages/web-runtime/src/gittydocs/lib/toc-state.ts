export interface TocState {
  slugs: readonly string[]
  activeSlug: string | null
  pinnedSlug: string | null
}

export type TocEvent =
  | { type: "reset"; slugs: readonly string[]; hash?: string }
  | { type: "select"; slug: string }
  | { type: "scroll"; slug: string | null }
  | { type: "intent" }

export function slugFromHash(hash: string | undefined): string | null {
  if (!hash) return null
  try {
    return decodeURIComponent(hash.replace(/^#/, "")) || null
  } catch {
    return null
  }
}

export function createTocState(slugs: readonly string[], hash?: string): TocState {
  const slug = slugFromHash(hash)
  const pinnedSlug = slug && slugs.includes(slug) ? slug : null
  return { slugs: [...slugs], activeSlug: pinnedSlug ?? slugs[0] ?? null, pinnedSlug }
}

/** A navigation selection stays pinned until user scroll intent, not scroll completion. */
export function reduceTocState(state: TocState, event: TocEvent): TocState {
  switch (event.type) {
    case "reset":
      return createTocState(event.slugs, event.hash)
    case "select":
      return state.slugs.includes(event.slug)
        ? { ...state, activeSlug: event.slug, pinnedSlug: event.slug }
        : state
    case "intent":
      return state.pinnedSlug ? { ...state, pinnedSlug: null } : state
    case "scroll":
      return !state.pinnedSlug && event.slug && state.slugs.includes(event.slug)
        ? { ...state, activeSlug: event.slug }
        : state
  }
}

export interface HeadingPosition {
  slug: string
  top: number
}

/** Last heading above the reading line, including gaps and fast jumps in either direction. */
export function getScrollActiveSlug(
  headings: readonly HeadingPosition[],
  offset: number,
  atBottom = false
): string | null {
  if (atBottom) return headings[headings.length - 1]?.slug ?? null
  let active = headings[0]?.slug ?? null
  for (const heading of headings) {
    if (heading.top > offset + 1) break
    active = heading.slug
  }
  return active
}

const scrollKeys = new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
  "Spacebar",
])

export function isScrollKey(event: {
  key: string
  defaultPrevented?: boolean
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  editable?: boolean
}): boolean {
  return (
    scrollKeys.has(event.key) &&
    !event.defaultPrevented &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.editable
  )
}
