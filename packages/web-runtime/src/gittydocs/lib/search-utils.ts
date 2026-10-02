import { Index } from "flexsearch"
import type { DocsPage } from "../contexts/docs.context"
import type { NavItem } from "./docs/config.gen"
import { type DocHeading, headingText, markdownToSearchText } from "./heading-utils"
import { findNavTrail, flattenNav, isInternalHref, isSafeNavHref } from "./nav-utils"
import {
  createSearchSnippet,
  highlightSearchText,
  type SearchHighlightSegment,
} from "./search-highlights"

export interface DocsSearchEntry {
  id: string
  kind: "page" | "heading"
  title: string
  pageTitle: string
  routePath: string
  href: string
  groupId: string
  groupLabel: string
  context: string
  icon?: string
  navItem?: NavItem
  heading?: DocHeading
  description: string
  body: string
  indexText: string
  order: number
}

export interface DocsSearchResult extends DocsSearchEntry {
  snippet: string
  highlights: SearchHighlightSegment[]
}

export interface DocsSearchGroup {
  id: string
  label: string
  results: DocsSearchResult[]
}

function routeKey(path: string): string {
  const route = path.split(/[?#]/)[0]
  return `/${route.split("/").filter(Boolean).join("/")}`
}

function formatRouteLabel(part: string): string {
  return part
    .replace(/^\d+-/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

/** Navigation metadata is display-only; a page absent from nav is still searchable. */
export function createSearchEntries(pages: DocsPage[], nav: NavItem[]): DocsSearchEntry[] {
  const navOrder = new Map<string, number>()
  const flattenedNav = flattenNav(nav)
  const navItemIds = new Map(flattenedNav.map((item, index) => [item, index]))
  flattenedNav.forEach((item, index) => {
    if (
      item.path &&
      isInternalHref(item.path) &&
      isSafeNavHref(item.path) &&
      !navOrder.has(routeKey(item.path))
    ) {
      navOrder.set(routeKey(item.path), index)
    }
  })
  const sortedPages = pages
    .map((page, index) => ({ page, index }))
    .sort((a, b) => {
      return (
        (navOrder.get(routeKey(a.page.routePath)) ?? flattenedNav.length + a.index) -
        (navOrder.get(routeKey(b.page.routePath)) ?? flattenedNav.length + b.index)
      )
    })
  const entries: DocsSearchEntry[] = []
  const seenRoutes = new Set<string>()

  for (const { page } of sortedPages) {
    const routePath = routeKey(page.routePath)
    if (seenRoutes.has(routePath)) continue
    seenRoutes.add(routePath)
    const trail = findNavTrail(nav, routePath)
    const leaf = trail[trail.length - 1]
    const matchedLeaf =
      leaf?.path &&
      isInternalHref(leaf.path) &&
      isSafeNavHref(leaf.path) &&
      routeKey(leaf.path) === routePath
        ? leaf
        : undefined
    const isGroupLanding = !!matchedLeaf?.items?.length
    const parents = matchedLeaf && !isGroupLanding ? trail.slice(0, -1) : trail
    const labels = parents.map((item) => item.label).filter(Boolean)
    if (!labels.length && !matchedLeaf) {
      labels.push(...routePath.split("/").filter(Boolean).slice(0, -1).map(formatRouteLabel))
    }
    const groupLabel = labels.join(" › ") || "Documentation"
    const headingLabels =
      isGroupLanding && labels[labels.length - 1] === page.title ? labels : [...labels, page.title]
    const groupId = parents.length
      ? `nav:${parents.map((item) => navItemIds.get(item)).join("/")}`
      : JSON.stringify(labels)
    const description = markdownToSearchText(page.description ?? "")
    const body = markdownToSearchText(page.rawContent)
    const icon = (matchedLeaf as (NavItem & { icon?: string }) | undefined)?.icon
    const common = {
      pageTitle: page.title,
      routePath,
      groupId,
      groupLabel,
      icon,
      navItem: matchedLeaf,
      description,
    }
    entries.push({
      ...common,
      id: `page:${routePath}`,
      kind: "page",
      title: page.title,
      href: routePath,
      context: groupLabel,
      body,
      indexText: [page.title, description, groupLabel, body].join(" "),
      order: entries.length,
    })

    for (const heading of page.headings) {
      const title = heading.plainText ?? headingText(heading.text)
      if (!title.trim()) continue
      entries.push({
        ...common,
        id: `heading:${routePath}#${heading.slug}`,
        kind: "heading",
        title,
        href: `${routePath}#${encodeURIComponent(heading.slug)}`,
        context: headingLabels.join(" › "),
        heading,
        body: "",
        indexText: title,
        order: entries.length,
      })
    }
  }
  return entries
}

export function groupSearchResults(results: DocsSearchResult[]): DocsSearchGroup[] {
  const groups = new Map<string, DocsSearchGroup>()
  for (const result of results) {
    let group = groups.get(result.groupId)
    if (!group) {
      group = { id: result.groupId, label: result.groupLabel, results: [] }
      groups.set(result.groupId, group)
    }
    group.results.push(result)
  }
  return [...groups.values()]
}

function titleScore(title: string, query: string): number {
  const text = title.toLocaleLowerCase()
  const value = query.toLocaleLowerCase()
  if (text === value) return 200
  if (text.startsWith(value)) return 150
  if (text.includes(value)) return 120
  const terms = value.split(/\s+/).filter(Boolean)
  if (terms.every((term) => text.includes(term))) return 100
  return 0
}

/** Pure FlexSearch wrapper, shared by the context and targeted unit tests. */
export function createDocsSearch(entries: DocsSearchEntry[], limit = 24) {
  const index = new Index({ tokenize: "full", cache: true })
  entries.forEach((entry, position) => {
    index.add(position, entry.indexText)
  })

  const resultFor = (entry: DocsSearchEntry, query: string): DocsSearchResult => {
    const snippetText =
      query && highlightSearchText(entry.body, query).some((part) => part.matched)
        ? entry.body
        : entry.description || entry.body
    const snippet = entry.kind === "page" ? createSearchSnippet(snippetText, query) : ""
    return { ...entry, snippet, highlights: snippet ? highlightSearchText(snippet, query) : [] }
  }

  return (input: string): DocsSearchResult[] => {
    const query = input.trim().slice(0, 200)
    if (!query) {
      // Round-robin browse makes small/deep sections useful even with a large nav.
      const groups = new Map<string, DocsSearchEntry[]>()
      entries
        .filter((entry) => entry.kind === "page")
        .forEach((entry) => {
          const group = groups.get(entry.groupId) ?? []
          group.push(entry)
          groups.set(entry.groupId, group)
        })
      const selected: DocsSearchResult[] = []
      for (let row = 0; selected.length < limit; row++) {
        let added = false
        for (const group of groups.values()) {
          const entry = group[row]
          if (entry && selected.length < limit) {
            selected.push(resultFor(entry, ""))
            added = true
          }
        }
        if (!added) break
      }
      return selected
    }

    // Request enough candidates for title ranking, rather than accepting the
    // body's index ordering. Literal title matches also cover punctuation (C++).
    const candidates = new Map<number, number>()
    index.search(query, { limit: Math.max(200, limit * 8) }).forEach((id, rank) => {
      candidates.set(Number(id), Math.max(0, 10 - rank / 20))
    })
    entries.forEach((entry, position) => {
      if (titleScore(entry.title, query)) candidates.set(position, candidates.get(position) ?? 0)
    })
    const ranked = [...candidates]
      .map(([position, rank]) => {
        const entry = entries[position]
        const title = titleScore(entry.title, query)
        return { entry, score: title + (title && entry.kind === "page" ? 15 : 0) + rank }
      })
      .sort((a, b) => b.score - a.score || a.entry.order - b.entry.order)

    // A page whose strongest match is a heading should not be shown twice merely
    // because the same heading text also lives in its raw body. Keep page hits
    // for genuine title/description matches and heading hits for exact anchors.
    const matchedHeadingPages = new Set(
      ranked.filter(({ entry }) => entry.kind === "heading").map(({ entry }) => entry.routePath)
    )

    const results: DocsSearchResult[] = []
    const headingCounts = new Map<string, number>()
    for (const { entry } of ranked) {
      if (
        entry.kind === "page" &&
        matchedHeadingPages.has(entry.routePath) &&
        !titleScore(entry.title, query) &&
        !titleScore(entry.description, query)
      )
        continue
      if (entry.kind === "heading") {
        const count = headingCounts.get(entry.routePath) ?? 0
        if (count >= 5) continue
        headingCounts.set(entry.routePath, count + 1)
      }
      results.push(resultFor(entry, query))
      if (results.length >= limit) break
    }
    return results
  }
}
